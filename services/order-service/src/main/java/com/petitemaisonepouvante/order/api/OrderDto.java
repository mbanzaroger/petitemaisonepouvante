package com.petitemaisonepouvante.order.api;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.petitemaisonepouvante.order.domain.Order;
import com.petitemaisonepouvante.order.domain.OrderLine;

/** Représentation d'une commande renvoyée à son propriétaire (l'identifiant client n'est pas exposé). */
public record OrderDto(UUID id, String status, int totalCents, String currency, OffsetDateTime createdAt,
        OffsetDateTime updatedAt, List<LineDto> lines) {

    public record LineDto(UUID productId, String productName, int quantity, int unitPriceCents, int subtotalCents) {

        static LineDto from(OrderLine line) {
            return new LineDto(line.productId(), line.productName(), line.quantity(), line.unitPriceCents(),
                    line.subtotalCents());
        }
    }

    public static OrderDto from(Order order) {
        return new OrderDto(order.id(), order.status().name(), order.totalCents(), order.currency(),
                order.createdAt(), order.updatedAt(), order.lines().stream().map(LineDto::from).toList());
    }
}
