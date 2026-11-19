package com.petitemaisonepouvante.catalog.product;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** US18 — modification d'un produit par l'administrateur, dont le retrait de la vente ({@code active = false}). */
public record ProductUpdateRequest(
        @NotBlank @Size(min = 3, max = 200) String name,
        @Size(max = 2000) String description,
        @Min(1) @Max(1_000_000) int priceCents,
        @NotBlank @Size(max = 100) String category,
        boolean exclusive,
        boolean active) {
}
