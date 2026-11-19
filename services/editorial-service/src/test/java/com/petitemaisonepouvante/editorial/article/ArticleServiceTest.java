package com.petitemaisonepouvante.editorial.article;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ArticleServiceTest {

    @Test
    void construitUneAdresseLisibleSansAccentsNiPonctuation() {
        assertThat(ArticleService.slugify("L'Orc revient : édition « spéciale » !")).isEqualTo("l-orc-revient-edition-speciale");
        assertThat(ArticleService.slugify("???")).isEqualTo("article");
        assertThat(ArticleService.slugify("a".repeat(100))).hasSize(80);
    }
}
