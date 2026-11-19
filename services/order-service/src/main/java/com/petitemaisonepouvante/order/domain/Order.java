package com.petitemaisonepouvante.order.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record Order(
        UUID id,
        String customerId,
        String customerName,
        OrderStatus status,
        int totalCents,
        String currency,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<OrderLine> lines) {

    /** Total calculé côté serveur ; un dépassement de capacité est refusé plutôt que silencieusement tronqué. */
    public static int total(List<OrderLine> lines) {
        int total = 0;
        for (OrderLine line : lines) {
            total = Math.addExact(total, line.subtotalCents());
        }
        return total;
    }
}
