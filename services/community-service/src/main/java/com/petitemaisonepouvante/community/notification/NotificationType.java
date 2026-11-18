package com.petitemaisonepouvante.community.notification;

/** Événements notifiés à un membre, rattachés à une catégorie de préférences (sauf la modération, toujours notifiée). */
public enum NotificationType {
    NEW_OFFER(Category.OFFERS),
    OFFER_ACCEPTED(Category.OFFERS),
    OFFER_DECLINED(Category.OFFERS),
    OFFER_CANCELLED(Category.OFFERS),
    NEW_MESSAGE(Category.MESSAGES),
    WISH_MATCH(Category.WISHES),
    INTEREST_MATCH(Category.BROWSING),
    CONTENT_HIDDEN(Category.MODERATION);

    /** Catégorie de préférences de notification. */
    public enum Category { OFFERS, MESSAGES, WISHES, BROWSING, MODERATION }

    private final Category category;

    NotificationType(Category category) {
        this.category = category;
    }

    public Category category() {
        return category;
    }
}
