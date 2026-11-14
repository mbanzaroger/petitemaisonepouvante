package com.petitemaisonepouvante.order.domain;

/** Cycle de vie d'une commande dans la saga : PENDING → CONFIRMED ou CANCELLED (états finaux). */
public enum OrderStatus {
    PENDING,
    CONFIRMED,
    CANCELLED
}
