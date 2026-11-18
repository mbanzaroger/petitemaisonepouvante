package com.petitemaisonepouvante.community.notification;

import jakarta.validation.constraints.NotNull;

/** Préférences de notification du membre (toutes actives par défaut). */
public record Preferences(@NotNull Boolean offers, @NotNull Boolean messages, @NotNull Boolean wishes) {

    public static final Preferences DEFAULT = new Preferences(true, true, true);

    public boolean accepts(NotificationType type) {
        return switch (type.category()) {
            case OFFERS -> offers;
            case MESSAGES -> messages;
            case WISHES -> wishes;
            case MODERATION -> true;
        };
    }
}
