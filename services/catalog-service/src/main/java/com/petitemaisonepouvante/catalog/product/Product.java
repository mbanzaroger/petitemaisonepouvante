package com.petitemaisonepouvante.catalog.product;

import java.util.UUID;

/** Produit dérivé vendu en ligne. Le prix est en centimes pour éviter toute erreur d'arrondi. */
public record Product(
        UUID id,
        String sku,
        String name,
        String description,
        int priceCents,
        String currency,
        String category,
        boolean active) {
}
