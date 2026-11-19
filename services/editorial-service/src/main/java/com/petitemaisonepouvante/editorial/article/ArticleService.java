package com.petitemaisonepouvante.editorial.article;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.editorial.observability.EditorialMetrics;
import com.petitemaisonepouvante.editorial.security.Member;
import com.petitemaisonepouvante.editorial.web.Problems;

/** US15 — publication d'actualités et d'articles de fond par la rédaction (rôle ADMIN). */
@Service
public class ArticleService {

    private final ArticleRepository articles;
    private final EditorialMetrics metrics;

    public ArticleService(ArticleRepository articles, EditorialMetrics metrics) {
        this.articles = articles;
        this.metrics = metrics;
    }

    @Transactional
    public Article publish(Member author, NewArticleRequest request) {
        String base = slugify(request.title());
        String slug = base;
        for (int suffix = 2; articles.slugExists(slug); suffix++) {
            slug = base + "-" + suffix;
        }
        Article article = articles.insert(slug, request.kind(), request.title().strip(), request.summary().strip(),
                request.body().strip(), author.name());
        metrics.articlePublished();
        return article;
    }

    @Transactional
    public void unpublish(UUID id) {
        if (!articles.unpublish(id)) {
            throw Problems.notFound("Article introuvable ou déjà retiré");
        }
    }

    /** Adresse lisible et stable : minuscules, sans accents, mots séparés par des tirets (80 caractères au plus). */
    static String slugify(String title) {
        String ascii = Normalizer.normalize(title, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        String slug = ascii.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        if (slug.length() > 80) {
            slug = slug.substring(0, 80).replaceAll("-+$", "");
        }
        return slug.isEmpty() ? "article" : slug;
    }
}
