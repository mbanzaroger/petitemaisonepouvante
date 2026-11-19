package com.petitemaisonepouvante.order.api;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.petitemaisonepouvante.order.domain.Order;

/**
 * Commande vue par l'administrateur (US19) : contenu et statut, avec le nom affiché du client. L'identifiant Keycloak
 * du client (pseudonyme) n'est pas exposé ; le nom est vide pour les commandes passées avant la version 1.5.0.
 */
public record AdminOrderDto(UUID id, String customerName, String status, int totalCents, String currency,
        OffsetDateTime createdAt, OffsetDateTime updatedAt, List<OrderDto.LineDto> lines) {

    public static AdminOrderDto from(Order order) {
        OrderDto dto = OrderDto.from(order);
        return new AdminOrderDto(dto.id(), order.customerName(), dto.status(), dto.totalCents(), dto.currency(),
                dto.createdAt(), dto.updatedAt(), dto.lines());
    }
}
