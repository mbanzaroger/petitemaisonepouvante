package com.petitemaisonepouvante.order.domain;

import java.util.UUID;

/** Ligne de commande ; le prix unitaire est celui relu dans le catalogue au moment de la commande. */
public record OrderLine(int lineNo, UUID productId, String productName, int quantity, int unitPriceCents) {

    public int subtotalCents() {
        return Math.multiplyExact(quantity, unitPriceCents);
    }
}
