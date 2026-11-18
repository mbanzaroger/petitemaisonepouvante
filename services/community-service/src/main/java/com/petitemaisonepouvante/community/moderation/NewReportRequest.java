package com.petitemaisonepouvante.community.moderation;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Signalement d'un contenu inapproprié (identifiant d'annonce UUID ou de message numérique) et son motif. */
public record NewReportRequest(
        @NotNull TargetType targetType,
        @NotBlank @Pattern(regexp = "[0-9a-fA-F-]{1,36}") String targetId,
        @NotBlank @Size(min = 3, max = 500) String reason) {
}
