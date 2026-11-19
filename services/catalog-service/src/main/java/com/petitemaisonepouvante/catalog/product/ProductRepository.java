package com.petitemaisonepouvante.catalog.product;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Accès aux produits par requêtes SQL paramétrées uniquement (politique de sécurité, OWASP A03). */
@Repository
public class ProductRepository {

    private static final String SELECT = """
            select p.id, p.sku, p.name, p.description, p.price_cents, p.currency, c.name as category, p.active,
                   p.exclusive
            from product p
            left join category c on c.id = p.category_id
            """;

    private final JdbcClient jdbc;

    public ProductRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Product> findActive(String category, boolean exclusiveOnly, int page, int size) {
        StringBuilder sql = new StringBuilder(SELECT).append(" where p.active");
        if (category != null) {
            sql.append(" and c.name = :category");
        }
        if (exclusiveOnly) {
            sql.append(" and p.exclusive");
        }
        sql.append(" order by p.name, p.id limit :limit offset :offset");
        JdbcClient.StatementSpec statement = jdbc.sql(sql.toString())
                .param("limit", size)
                .param("offset", (long) page * size);
        if (category != null) {
            statement = statement.param("category", category);
        }
        return statement.query(ProductRepository::map).list();
    }

    public long countActive(String category, boolean exclusiveOnly) {
        StringBuilder sql = new StringBuilder(
                "select count(*) from product p left join category c on c.id = p.category_id where p.active");
        if (exclusiveOnly) {
            sql.append(" and p.exclusive");
        }
        if (category == null) {
            return jdbc.sql(sql.toString()).query(Long.class).single();
        }
        return jdbc.sql(sql.append(" and c.name = :category").toString()).param("category", category)
                .query(Long.class).single();
    }

    /** Produits en vente des catégories données (recommandations), exclusivités d'abord. */
    public List<Product> findActiveInCategories(Collection<Long> categoryIds, int limit) {
        return jdbc.sql(SELECT + " where p.active and p.category_id in (:categories)"
                        + " order by p.exclusive desc, p.created_at desc, p.id limit :limit")
                .param("categories", categoryIds)
                .param("limit", limit)
                .query(ProductRepository::map)
                .list();
    }

    /** Sélection par défaut (visiteur, ou membre sans personnalisation) : exclusivités puis nouveautés. */
    public List<Product> findShowcase(int limit) {
        return jdbc.sql(SELECT + " where p.active order by p.exclusive desc, p.created_at desc, p.name, p.id limit :limit")
                .param("limit", limit)
                .query(ProductRepository::map)
                .list();
    }

    public Optional<Long> findCategoryId(String name) {
        return jdbc.sql("select id from category where name = :name").param("name", name).query(Long.class).optional();
    }

    public Optional<Long> findCategoryIdOfProduct(UUID productId) {
        return jdbc.sql("select category_id from product where id = :id and category_id is not null")
                .param("id", productId).query(Long.class).optional();
    }

    public Optional<Product> findById(UUID id) {
        return jdbc.sql(SELECT + " where p.id = :id").param("id", id).query(ProductRepository::map).optional();
    }

    public List<Product> findAllById(Collection<UUID> ids) {
        return jdbc.sql(SELECT + " where p.id in (:ids) order by p.name").param("ids", ids)
                .query(ProductRepository::map).list();
    }

    public List<String> findCategoryNames() {
        return jdbc.sql("select name from category order by name").query(String.class).list();
    }

    private static Product map(ResultSet rs, int row) throws SQLException {
        return new Product(
                rs.getObject("id", UUID.class),
                rs.getString("sku"),
                rs.getString("name"),
                rs.getString("description"),
                rs.getInt("price_cents"),
                rs.getString("currency").trim(),
                rs.getString("category"),
                rs.getBoolean("active"),
                rs.getBoolean("exclusive"));
    }
}
