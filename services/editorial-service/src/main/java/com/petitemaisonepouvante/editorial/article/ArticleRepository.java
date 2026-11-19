package com.petitemaisonepouvante.editorial.article;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Persistance des articles, requêtes SQL paramétrées uniquement. */
@Repository
public class ArticleRepository {

    private static final String COLUMNS = "id, slug, kind, title, summary, body, author, published, published_at";

    private final JdbcClient jdbc;

    public ArticleRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Article> findPublished(ArticleKind kind, int page, int size) {
        String where = kind == null ? " where published" : " where published and kind = :kind";
        JdbcClient.StatementSpec statement = jdbc.sql("select " + COLUMNS + " from article" + where
                        + " order by published_at desc, id limit :limit offset :offset")
                .param("limit", size)
                .param("offset", (long) page * size);
        if (kind != null) {
            statement = statement.param("kind", kind.name());
        }
        return statement.query(ArticleRepository::map).list();
    }

    public long countPublished(ArticleKind kind) {
        if (kind == null) {
            return jdbc.sql("select count(*) from article where published").query(Long.class).single();
        }
        return jdbc.sql("select count(*) from article where published and kind = :kind").param("kind", kind.name())
                .query(Long.class).single();
    }

    public Optional<Article> findPublishedBySlug(String slug) {
        return jdbc.sql("select " + COLUMNS + " from article where slug = :slug and published").param("slug", slug)
                .query(ArticleRepository::map).optional();
    }

    public boolean slugExists(String slug) {
        return jdbc.sql("select count(*) from article where slug = :slug").param("slug", slug)
                .query(Long.class).single() > 0;
    }

    public Article insert(String slug, ArticleKind kind, String title, String summary, String body, String author) {
        return jdbc.sql("insert into article (id, slug, kind, title, summary, body, author) "
                        + "values (:id, :slug, :kind, :title, :summary, :body, :author) returning " + COLUMNS)
                .param("id", UUID.randomUUID())
                .param("slug", slug)
                .param("kind", kind.name())
                .param("title", title)
                .param("summary", summary)
                .param("body", body)
                .param("author", author)
                .query(ArticleRepository::map)
                .single();
    }

    public boolean unpublish(UUID id) {
        return jdbc.sql("update article set published = false where id = :id and published").param("id", id)
                .update() > 0;
    }

    private static Article map(ResultSet rs, int row) throws SQLException {
        return new Article(
                rs.getObject("id", UUID.class),
                rs.getString("slug"),
                ArticleKind.valueOf(rs.getString("kind")),
                rs.getString("title"),
                rs.getString("summary"),
                rs.getString("body"),
                rs.getString("author"),
                rs.getBoolean("published"),
                rs.getObject("published_at", OffsetDateTime.class));
    }
}
