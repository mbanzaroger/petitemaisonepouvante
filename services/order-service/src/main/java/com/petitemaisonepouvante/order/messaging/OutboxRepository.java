package com.petitemaisonepouvante.order.messaging;

import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Boîte d'envoi transactionnelle (« transactional outbox ») : l'événement est écrit dans la même transaction
 * que la donnée métier, puis publié par {@link OutboxPublisher}. Aucun événement n'est perdu si le broker
 * est indisponible au moment de la commande.
 */
@Repository
public class OutboxRepository {

    private final JdbcClient jdbc;

    public OutboxRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void add(OutboxEvent event) {
        jdbc.sql("""
                insert into outbox_event (id, routing_key, payload, correlation_id)
                values (:id, :routingKey, :payload, :correlationId)
                """)
                .param("id", event.id())
                .param("routingKey", event.routingKey())
                .param("payload", event.payload())
                .param("correlationId", event.correlationId())
                .update();
    }

    /** Verrouille un lot d'événements non publiés ; SKIP LOCKED permet plusieurs instances du service. */
    public List<OutboxEvent> lockPending(int limit) {
        return jdbc.sql("""
                select id, routing_key, payload, correlation_id from outbox_event
                where published_at is null order by created_at limit :limit for update skip locked
                """)
                .param("limit", limit)
                .query((rs, row) -> new OutboxEvent(
                        rs.getObject("id", UUID.class),
                        rs.getString("routing_key"),
                        rs.getString("payload"),
                        rs.getString("correlation_id")))
                .list();
    }

    public void markPublished(UUID id) {
        jdbc.sql("update outbox_event set published_at = now() where id = :id").param("id", id).update();
    }

    public long countPending() {
        return jdbc.sql("select count(*) from outbox_event where published_at is null").query(Long.class).single();
    }
}
