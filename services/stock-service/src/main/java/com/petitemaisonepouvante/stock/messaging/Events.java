package com.petitemaisonepouvante.stock.messaging;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contrats JSON des événements de la saga (voir docs/03-saga-commande.md). */
public final class Events {

    private Events() {
    }

    /** Événement reçu de order-service. */
    public record OrderPlaced(UUID eventId, String type, UUID orderId, String correlationId, List<Line> lines) {

        public record Line(UUID productId, int quantity) {
        }

        public boolean valid() {
            return eventId != null && orderId != null && lines != null && !lines.isEmpty()
                    && lines.stream().allMatch(l -> l != null && l.productId() != null && l.quantity() > 0);
        }
    }

    /** StockReserved ou StockRejected, publié vers order-service. */
    public record StockResult(UUID eventId, String type, Instant occurredAt, String correlationId, UUID orderId,
            String reason) {

        public static StockResult reserved(UUID orderId, String correlationId) {
            return new StockResult(UUID.randomUUID(), "StockReserved", Instant.now(), correlationId, orderId, null);
        }

        public static StockResult rejected(UUID orderId, String correlationId, String reason) {
            return new StockResult(UUID.randomUUID(), "StockRejected", Instant.now(), correlationId, orderId, reason);
        }
    }
}
