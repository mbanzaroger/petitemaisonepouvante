package com.petitemaisonepouvante.catalog.product;

import java.util.UUID;

/**
 * Représentation publique d'un produit (contrat de l'API v1). {@code imageUrl} : adresse de l'image, versionnée
 * (une nouvelle image change l'adresse), ou {@code null} si le produit n'a pas d'image.
 */
public record ProductDto(
        UUID id,
        String sku,
        String name,
        String description,
        Price price,
        String category,
        boolean available,
        boolean exclusive,
        String imageUrl) {

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
                product.active(),
                product.exclusive(),
                product.imageVersion() == null ? null
                        : "/api/v1/products/" + product.id() + "/image?v=" + product.imageVersion());
    }
}
