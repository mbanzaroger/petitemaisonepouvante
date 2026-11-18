package com.petitemaisonepouvante.community.notification;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Objet recherché, décrit par quelques mots (ex. « Evil Ed », « affiche Suspiria »). */
public record NewWishRequest(@NotBlank @Size(min = 2, max = 60) String keywords) {
}
