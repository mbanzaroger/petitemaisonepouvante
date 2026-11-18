package com.petitemaisonepouvante.community.listing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Publication d'une annonce. Longueurs bornées (stockage, affichage, anti-abus). */
public record NewListingRequest(
        @NotNull ListingType type,
        @NotBlank @Size(min = 3, max = 120) String title,
        @NotBlank @Size(min = 10, max = 2000) String description,
        @NotNull Category category,
        @NotNull ItemCondition condition,
        @Size(max = 300) String wanted) {
}
