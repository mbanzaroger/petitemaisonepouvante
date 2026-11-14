package com.petitemaisonepouvante.catalog.product;

import java.util.UUID;

/** Représentation publique d'un produit (contrat de l'API v1). */
public record ProductDto(
        UUID id,
        String sku,
        String name,
        String description,
        Price price,
        String category,
        boolean available) {

    public record Price(int amountCents, String currency) {
    }

    public static ProductDto from(Product product) {
        return new ProductDto(
                product.id(),
                product.sku(),
                product.name(),
                product.description(),
                new Price(product.priceCents(), product.currency()),
                product.category(),
                product.active());
    }
}
