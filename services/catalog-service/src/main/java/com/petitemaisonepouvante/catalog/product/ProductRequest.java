package com.petitemaisonepouvante.catalog.product;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * US18 — création d'un produit par l'administrateur. Prix en centimes (1 centime à 10 000 €) ; la catégorie doit
 * exister ; référence en majuscules, chiffres et tirets, unique.
 */
public record ProductRequest(
        @NotBlank @Pattern(regexp = "^[A-Z0-9][A-Z0-9-]{2,39}$",
                message = "3 à 40 caractères : majuscules, chiffres et tirets") String sku,
        @NotBlank @Size(min = 3, max = 200) String name,
        @Size(max = 2000) String description,
        @Min(1) @Max(1_000_000) int priceCents,
        @NotBlank @Size(max = 100) String category,
        boolean exclusive) {
}
