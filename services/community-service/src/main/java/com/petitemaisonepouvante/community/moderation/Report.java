package com.petitemaisonepouvante.community.moderation;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Signalement vu par la modération, avec un extrait du contenu visé et le nom de son auteur
 * ({@code targetAuthorId} sert à le prévenir si le contenu est masqué ; il n'est pas exposé).
 */
public record Report(UUID id, TargetType targetType, String targetId, String excerpt, String targetAuthorId,
        String targetAuthorName, String reporterName, String reason, ReportStatus status, OffsetDateTime createdAt,
        String handledBy, OffsetDateTime handledAt) {
}
