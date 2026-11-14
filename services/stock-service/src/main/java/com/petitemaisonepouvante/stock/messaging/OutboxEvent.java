package com.petitemaisonepouvante.stock.messaging;

import java.util.UUID;

/** Événement en attente de publication ; {@code id} sert aussi d'identifiant d'événement (idempotence). */
public record OutboxEvent(UUID id, String routingKey, String payload, String correlationId) {
}
