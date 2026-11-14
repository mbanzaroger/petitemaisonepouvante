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
            select p.id, p.sku, p.name, p.description, p.price_cents, p.currency, c.name as category, p.active
            from product p
            left join category c on c.id = p.category_id
            """;

    private final JdbcClient jdbc;

    public ProductRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Product> findActive(String category, int page, int size) {
        StringBuilder sql = new StringBuilder(SELECT).append(" where p.active");
        if (category != null) {
            sql.append(" and c.name = :category");
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

    public long countActive(String category) {
        String sql = "select count(*) from product p left join category c on c.id = p.category_id where p.active";
        if (category == null) {
            return jdbc.sql(sql).query(Long.class).single();
        }
        return jdbc.sql(sql + " and c.name = :category").param("category", category).query(Long.class).single();
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
                rs.getBoolean("active"));
    }
}
