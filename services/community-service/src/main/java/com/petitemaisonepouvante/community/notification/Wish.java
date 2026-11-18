package com.petitemaisonepouvante.community.notification;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Objet recherché par un membre : il est prévenu quand une annonce correspondante est publiée. */
public record Wish(UUID id, String keywords, OffsetDateTime createdAt) {
}
