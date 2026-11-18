package com.petitemaisonepouvante.community.notification;

import java.time.OffsetDateTime;

/** Notification interne au site : texte court et lien vers la page concernée (chemin relatif du site). */
public record Notification(long id, NotificationType type, String text, String link, boolean read,
        OffsetDateTime createdAt) {
}
