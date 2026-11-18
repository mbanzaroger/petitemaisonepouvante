package com.petitemaisonepouvante.community.chat;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Message publié dans un salon ({@code roomCode}) ou dans la conversation privée d'une proposition ({@code offerId}).
 * L'identifiant croissant sert de curseur aux clients qui interrogent périodiquement les nouveaux messages.
 */
public record ChatMessage(long id, String roomCode, UUID offerId, String authorId, String authorName, String content,
        boolean hidden, OffsetDateTime sentAt) {
}
