package com.petitemaisonepouvante.stock.reservation;

import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.stock.messaging.Events;
import com.petitemaisonepouvante.stock.messaging.Messaging;
import com.petitemaisonepouvante.stock.messaging.OutboxEvent;
import com.petitemaisonepouvante.stock.messaging.OutboxRepository;

import tools.jackson.databind.json.JsonMapper;

/**
 * US3, étape 2 de la saga : réserve tout le stock d'une commande ou rien (pas de réservation partielle).
 * Idempotence : l'identifiant d'événement est enregistré dans la même transaction que la réservation,
 * donc un OrderPlaced rejoué ne décrémente jamais le stock deux fois (validé par l'expérimentation E3).
 */
@Service
public class ReservationService {

    private static final Logger LOG = LoggerFactory.getLogger(ReservationService.class);

    public enum Outcome { RESERVED, REJECTED, DUPLICATE }

    private final StockRepository stock;
    private final OutboxRepository outbox;
    private final JsonMapper json;

    public ReservationService(StockRepository stock, OutboxRepository outbox, JsonMapper json) {
        this.stock = stock;
        this.outbox = outbox;
        this.json = json;
    }

    @Transactional
    public Outcome reserve(Events.OrderPlaced event) {
        if (!stock.markProcessed(event.eventId())) {
            LOG.info("Événement {} déjà traité : ignoré", event.eventId());
            return Outcome.DUPLICATE;
        }
        if (!event.valid()) {
            return reject(event, "Commande invalide (lignes absentes ou quantités nulles)");
        }
        Map<UUID, Integer> wanted = new TreeMap<>();
        event.lines().forEach(line -> wanted.merge(line.productId(), line.quantity(), Math::addExact));
        Map<UUID, Integer> available = stock.lockAvailable(wanted.keySet());
        for (Map.Entry<UUID, Integer> entry : wanted.entrySet()) {
            Integer inStock = available.get(entry.getKey());
            if (inStock == null) {
                return reject(event, "Produit sans stock référencé : " + entry.getKey());
            }
            if (inStock < entry.getValue()) {
                return reject(event, "Stock insuffisant pour " + entry.getKey() + " (" + inStock + " disponible(s))");
            }
        }
        wanted.forEach((product, quantity) -> stock.reserve(event.orderId(), product, quantity));
        publish(Events.StockResult.reserved(event.orderId(), event.correlationId()), Messaging.STOCK_RESERVED);
        LOG.info("Stock réservé pour la commande {} ({} produit(s))", event.orderId(), wanted.size());
        return Outcome.RESERVED;
    }

    private Outcome reject(Events.OrderPlaced event, String reason) {
        publish(Events.StockResult.rejected(event.orderId(), event.correlationId(), reason), Messaging.STOCK_REJECTED);
        LOG.info("Réservation refusée pour la commande {} : {}", event.orderId(), reason);
        return Outcome.REJECTED;
    }

    private void publish(Events.StockResult result, String routingKey) {
        outbox.add(new OutboxEvent(result.eventId(), routingKey, json.writeValueAsString(result),
                result.correlationId()));
    }
}
