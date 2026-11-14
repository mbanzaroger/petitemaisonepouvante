package com.petitemaisonepouvante.order.catalog;

import java.util.UUID;

/** Sous-ensemble du contrat de catalog-service utile à la commande. */
public record CatalogProduct(UUID id, String name, Price price, boolean available) {

    public record Price(int amountCents, String currency) {
    }
}
