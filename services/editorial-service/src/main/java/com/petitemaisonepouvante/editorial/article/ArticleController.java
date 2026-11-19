package com.petitemaisonepouvante.editorial.article;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.editorial.security.Member;
import com.petitemaisonepouvante.editorial.web.PageDto;
import com.petitemaisonepouvante.editorial.web.Problems;

/** US15 — actualités et articles de fond en accès libre ; publication et retrait par la rédaction (ADMIN). */
@RestController
@RequestMapping("/api/v1/editorial")
public class ArticleController {

    private final ArticleRepository articles;
    private final ArticleService service;

    public ArticleController(ArticleRepository articles, ArticleService service) {
        this.articles = articles;
        this.service = service;
    }

    /** Résumé affiché dans les listes (sans le corps). */
    public record SummaryDto(UUID id, String slug, ArticleKind kind, String title, String summary, String author,
            OffsetDateTime publishedAt) {

        static SummaryDto from(Article article) {
            return new SummaryDto(article.id(), article.slug(), article.kind(), article.title(), article.summary(),
                    article.author(), article.publishedAt());
        }
    }

    public record ArticleDto(UUID id, String slug, ArticleKind kind, String title, String summary, String body,
            String author, OffsetDateTime publishedAt) {

        static ArticleDto from(Article article) {
            return new ArticleDto(article.id(), article.slug(), article.kind(), article.title(), article.summary(),
                    article.body(), article.author(), article.publishedAt());
        }
    }

    @GetMapping("/articles")
    public PageDto<SummaryDto> list(@RequestParam(required = false) ArticleKind kind,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size) {
        List<SummaryDto> content = articles.findPublished(kind, page, size).stream().map(SummaryDto::from).toList();
        return PageDto.of(content, page, size, articles.countPublished(kind));
    }

    @GetMapping("/articles/{slug}")
    public ArticleDto one(@PathVariable @Pattern(regexp = "[a-z0-9-]{1,90}") String slug) {
        return articles.findPublishedBySlug(slug).map(ArticleDto::from)
                .orElseThrow(() -> Problems.notFound("Article introuvable"));
    }

    @PostMapping("/admin/articles")
    public ResponseEntity<ArticleDto> publish(JwtAuthenticationToken authentication,
            @Valid @RequestBody NewArticleRequest request) {
        Article article = service.publish(Member.of(authentication), request);
        return ResponseEntity.created(URI.create("/api/v1/editorial/articles/" + article.slug()))
                .body(ArticleDto.from(article));
    }

    @PostMapping("/admin/articles/{id}/unpublish")
    public ResponseEntity<Void> unpublish(@PathVariable UUID id) {
        service.unpublish(id);
        return ResponseEntity.noContent().build();
    }
}
