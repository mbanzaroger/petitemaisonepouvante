package com.petitemaisonepouvante.catalog.product;

import java.util.UUID;

/**
 * Produit dérivé vendu en ligne. Le prix est en centimes pour éviter toute erreur d'arrondi.
 * {@code exclusive} : produit vendu en exclusivité sur le site (gamme de figurines du collectif Evil Ed).
 * {@code imageVersion} : version courte de l'image du produit, ou {@code null} s'il n'en a pas (US21).
 */
public record Product(
        UUID id,
        String sku,
        String name,
        String description,
        int priceCents,
        String currency,
        String category,
        boolean active,
        boolean exclusive,
        String imageVersion) {
}
