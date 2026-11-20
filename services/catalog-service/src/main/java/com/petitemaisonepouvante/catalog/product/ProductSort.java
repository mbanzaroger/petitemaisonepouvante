package com.petitemaisonepouvante.catalog.product;

import java.util.Arrays;
import java.util.Optional;

/**
 * Tris proposés par le catalogue (US22). Liste fermée : le paramètre de l'API choisit une clause ORDER BY écrite
 * ici, jamais concaténée depuis la requête (OWASP A03).
 */
public enum ProductSort {
    NAME("name", "p.name, p.id"),
    PRICE_ASC("price-asc", "p.price_cents, p.name, p.id"),
    PRICE_DESC("price-desc", "p.price_cents desc, p.name, p.id"),
    NEWEST("newest", "p.created_at desc, p.name, p.id");

    private final String parameter;
    private final String orderBy;

    ProductSort(String parameter, String orderBy) {
        this.parameter = parameter;
        this.orderBy = orderBy;
    }

    public String orderBy() {
        return orderBy;
    }

    public static Optional<ProductSort> of(String parameter) {
        return Arrays.stream(values()).filter(s -> s.parameter.equals(parameter)).findFirst();
    }
}
