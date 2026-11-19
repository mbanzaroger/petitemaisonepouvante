package com.petitemaisonepouvante.community.moderation;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Signalement présenté à la modération (sans l'identifiant de l'auteur du contenu). */
public record ReportDto(UUID id, TargetType targetType, String targetId, String excerpt, String targetAuthorName,
        String reporterName, String reason, ReportStatus status, OffsetDateTime createdAt, String handledBy,
        OffsetDateTime handledAt) {

    public static ReportDto from(Report report) {
        return new ReportDto(report.id(), report.targetType(), report.targetId(), report.excerpt(),
                report.targetAuthorName(), report.reporterName(), report.reason(), report.status(), report.createdAt(),
                report.handledBy(), report.handledAt());
    }
}
