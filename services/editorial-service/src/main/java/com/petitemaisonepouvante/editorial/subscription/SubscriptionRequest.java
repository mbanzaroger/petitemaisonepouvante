package com.petitemaisonepouvante.editorial.subscription;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

/** Souscription ou renouvellement : formule et, pour le papier, adresse de livraison. */
public record SubscriptionRequest(@NotNull Plan plan, @Valid Address address) {
}
