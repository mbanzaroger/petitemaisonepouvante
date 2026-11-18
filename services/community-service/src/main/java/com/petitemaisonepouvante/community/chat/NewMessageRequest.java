package com.petitemaisonepouvante.community.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Nouveau message (salon ou proposition), texte brut de 1 000 caractères au plus. */
public record NewMessageRequest(@NotBlank @Size(max = 1000) String content) {
}
