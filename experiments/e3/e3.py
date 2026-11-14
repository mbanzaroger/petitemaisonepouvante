"""Banc d'essai de l'expérimentation E3 : saga OrderPlaced -> réservation de stock sur RabbitMQ.

Modes :
  saga              fiabilité + idempotence (crash d'un consommateur, doublons, message empoisonné vers la DLQ)
  publish N LABEL   publie N événements avec confirmations, en se reconnectant si un nœud tombe
  drain EXPECTED    consomme la file et vérifie qu'aucun message confirmé n'a été perdu ni dupliqué
Chaque mode écrit une ligne « RESULT {json} » exploitée par le workflow.
"""
import json
import os
import sqlite3
import sys
import time
import uuid

import pika
from pika.exceptions import AMQPError

EXCHANGE, DLX = "orders", "orders.dlx"
QUEUE, DLQ = "stock.order-placed", "stock.order-placed.dlq"
DURABILITY_QUEUE = "e3.durabilite"
PARAMS = pika.ConnectionParameters(
    host=os.environ.get("RABBIT_HOST", "pme-rabbit.pme-mq.svc"),
    credentials=pika.PlainCredentials(os.environ["RABBIT_USER"], os.environ["RABBIT_PASSWORD"]),
    heartbeat=20, blocked_connection_timeout=30, connection_attempts=20, retry_delay=3,
)


def result(**data):
    print("RESULT " + json.dumps(data, ensure_ascii=False), flush=True)


def connect():
    return pika.BlockingConnection(PARAMS)


def declare(ch):
    ch.exchange_declare(EXCHANGE, "topic", durable=True)
    ch.exchange_declare(DLX, "fanout", durable=True)
    ch.queue_declare(DLQ, durable=True, arguments={"x-queue-type": "quorum"})
    ch.queue_bind(DLQ, DLX)
    ch.queue_declare(QUEUE, durable=True, arguments={
        "x-queue-type": "quorum", "x-dead-letter-exchange": DLX, "x-delivery-limit": 3})
    ch.queue_bind(QUEUE, EXCHANGE, routing_key="order.placed")
    ch.queue_declare(DURABILITY_QUEUE, durable=True, arguments={"x-queue-type": "quorum"})
    ch.queue_bind(DURABILITY_QUEUE, EXCHANGE, routing_key="durability")


class StockStore:
    """Équivalent des tables stock_item et processed_event de stock-service."""

    def __init__(self, initial):
        self.db = sqlite3.connect(":memory:", isolation_level=None)
        self.db.execute("create table stock(product text primary key, available int check (available >= 0))")
        self.db.execute("create table processed(event_id text primary key)")
        self.db.execute("insert into stock values ('P1', ?)", (initial,))
        self.duplicates = 0

    def handle(self, event):
        """Réserve le stock dans la même transaction que l'enregistrement de l'événement traité."""
        try:
            self.db.execute("begin")
            self.db.execute("insert into processed values (?)", (event["eventId"],))
            self.db.execute("update stock set available = available - ? where product = 'P1'", (event["quantity"],))
            self.db.execute("commit")
            return True
        except sqlite3.IntegrityError:
            self.db.execute("rollback")
            self.duplicates += 1
            return False

    def available(self):
        return self.db.execute("select available from stock").fetchone()[0]

    def processed(self):
        return self.db.execute("select count(*) from processed").fetchone()[0]


def publish_events(ch, events, routing_key="order.placed"):
    for e in events:
        body = e if isinstance(e, (bytes, str)) else json.dumps(e)
        ch.basic_publish(EXCHANGE, routing_key, body, pika.BasicProperties(
            delivery_mode=2, content_type="application/json",
            message_id=e["eventId"] if isinstance(e, dict) else str(uuid.uuid4())), mandatory=True)


def consume(ch, store, stop_after_acks=None, crash=False, idle=3.0):
    """Consomme jusqu'à vider la file. En mode crash : traite un message sans l'acquitter puis coupe la connexion."""
    acks = redelivered = 0
    ch.basic_qos(prefetch_count=10)
    for method, props, body in ch.consume(QUEUE, inactivity_timeout=idle):
        if method is None:
            break
        if method.redelivered:
            redelivered += 1
        try:
            event = json.loads(body)
        except ValueError:
            ch.basic_nack(method.delivery_tag, requeue=True)  # message empoisonné : rejeté à chaque livraison
            continue
        store.handle(event)
        if crash and stop_after_acks is not None and acks >= stop_after_acks:
            return acks, redelivered, True  # crash simulé : traité en base mais jamais acquitté
        ch.basic_ack(method.delivery_tag)
        acks += 1
    ch.cancel()
    return acks, redelivered, False


def mode_saga():
    conn = connect(); ch = conn.channel(); declare(ch)
    ch.queue_purge(QUEUE); ch.queue_purge(DLQ)
    ch.confirm_delivery()
    events = [{"eventId": str(uuid.uuid4()), "orderId": str(uuid.uuid4()), "product": "P1", "quantity": 1}
              for _ in range(200)]
    t = time.time()
    publish_events(ch, events + events[:20])  # 20 doublons exacts (même eventId)
    publish_events(ch, ["pas du json"])        # message empoisonné
    publish_ms = round((time.time() - t) * 1000)
    conn.close()

    store = StockStore(1000)
    c1 = connect()
    acks1, _, crashed = consume(c1.channel(), store, stop_after_acks=80, crash=True)
    c1.close()  # fermeture sans acquittement : les messages en vol sont relivrés
    c2 = connect()
    acks2, redelivered2, _ = consume(c2.channel(), store, idle=8.0)
    time.sleep(3)
    ch = c2.channel()
    dlq = ch.queue_declare(DLQ, passive=True).method.message_count
    remaining = ch.queue_declare(QUEUE, passive=True).method.message_count
    c2.close()
    ok = store.processed() == 200 and store.available() == 800 and dlq == 1 and remaining == 0
    result(mode="saga", publies=221, empoisonne=1, publication_ms=publish_ms, crash_simule=crashed,
           acquittes_consommateur1=acks1, acquittes_consommateur2=acks2, relivres_apres_crash=redelivered2,
           evenements_traites=store.processed(), doublons_ignores=store.duplicates,
           stock_initial=1000, stock_final=store.available(), dlq=dlq, file_restante=remaining, ok=ok)
    return ok


def mode_publish(n, label):
    confirmed, reconnects, sent = 0, 0, 0
    t = time.time()
    conn = ch = None
    while confirmed < n:
        try:
            if conn is None or conn.is_closed:
                conn = connect(); ch = conn.channel(); declare(ch); ch.confirm_delivery()
            ch.basic_publish(EXCHANGE, "durability", json.dumps({"label": label, "seq": confirmed}),
                             pika.BasicProperties(delivery_mode=2, message_id=f"{label}-{confirmed}"), mandatory=True)
            sent += 1
            confirmed += 1  # en mode confirm, basic_publish ne rend la main qu'après l'accusé du broker
        except AMQPError:
            reconnects += 1
            conn = None
            time.sleep(1)
    duration = time.time() - t
    conn.close()
    result(mode="publish", label=label, confirmes=confirmed, tentatives=sent + reconnects, reconnexions=reconnects,
           duree_s=round(duration, 1), debit_msg_s=round(confirmed / duration))
    return True


def mode_drain(expected):
    conn = connect(); ch = conn.channel()
    ids = []
    for method, props, body in ch.consume(DURABILITY_QUEUE, inactivity_timeout=5):
        if method is None:
            break
        ids.append(props.message_id)
        ch.basic_ack(method.delivery_tag)
    conn.close()
    ok = len(set(ids)) == expected
    result(mode="drain", attendus=expected, recus=len(ids), uniques=len(set(ids)), ok=ok)
    return ok


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "saga":
        success = mode_saga()
    elif mode == "publish":
        success = mode_publish(int(sys.argv[2]), sys.argv[3])
    else:
        success = mode_drain(int(sys.argv[2]))
    sys.exit(0 if success else 1)
