package com.petitemaisonepouvante.editorial.article;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Actualité ou article de fond, en accès libre. Le corps est du texte brut : paragraphes séparés par une ligne vide. */
public record Article(UUID id, String slug, ArticleKind kind, String title, String summary, String body, String author,
        boolean published, OffsetDateTime publishedAt) {
}
