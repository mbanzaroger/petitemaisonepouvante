package com.petitemaisonepouvante.editorial.article;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Nouvel article : texte brut (paragraphes séparés par une ligne vide), affiché tel quel par le site. */
public record NewArticleRequest(
        @NotNull ArticleKind kind,
        @NotBlank @Size(min = 5, max = 160) String title,
        @NotBlank @Size(min = 10, max = 300) String summary,
        @NotBlank @Size(min = 20, max = 20000) String body) {
}
