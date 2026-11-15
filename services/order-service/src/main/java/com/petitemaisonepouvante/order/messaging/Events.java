package com.petitemaisonepouvante.order.messaging;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Contrats JSON des événements échangés par la saga (voir docs/03-saga-commande.md). */
public final class Events {

    private Events() {
    }

    public record OrderPlaced(UUID eventId, String type, Instant occurredAt, String correlationId,
            UUID orderId, String customerId, List<Line> lines) {

        public record Line(UUID productId, int quantity) {
        }

        public static OrderPlaced of(UUID eventId, String correlationId, UUID orderId, String customerId,
                List<Line> lines) {
            return new OrderPlaced(eventId, "OrderPlaced", Instant.now(), correlationId, orderId, customerId, lines);
        }
    }

    /** StockReserved ou StockRejected publié par stock-service. */
    public record StockResult(UUID eventId, String type, UUID orderId, String reason) {

        public boolean reserved() {
            return "StockReserved".equals(type);
        }

        public boolean valid() {
            return eventId != null && orderId != null && ("StockReserved".equals(type) || "StockRejected".equals(type));
        }
    }
}
