package com.petitemaisonepouvante.community.notification;

import jakarta.validation.constraints.NotNull;

/**
 * Préférences de notification du membre. Propositions, messages et recherches sont actifs par défaut ;
 * {@code browsing} (notifications selon la navigation, qui suppose d'enregistrer les catégories consultées) est
 * désactivé par défaut et vaut consentement quand le membre l'active.
 */
public record Preferences(@NotNull Boolean offers, @NotNull Boolean messages, @NotNull Boolean wishes,
        @NotNull Boolean browsing) {

    public static final Preferences DEFAULT = new Preferences(true, true, true, false);

    public boolean accepts(NotificationType type) {
        return switch (type.category()) {
            case OFFERS -> offers;
            case MESSAGES -> messages;
            case WISHES -> wishes;
            case BROWSING -> browsing;
            case MODERATION -> true;
        };
    }
}
