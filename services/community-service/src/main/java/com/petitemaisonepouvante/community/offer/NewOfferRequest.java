package com.petitemaisonepouvante.community.offer;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Proposition : message à l'auteur de l'annonce (objet proposé en échange, disponibilités pour la remise…). */
public record NewOfferRequest(@NotBlank @Size(min = 2, max = 1000) String message) {
}
