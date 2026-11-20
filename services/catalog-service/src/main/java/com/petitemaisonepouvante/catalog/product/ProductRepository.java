package com.petitemaisonepouvante.catalog.product;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.text.Normalizer;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Accès aux produits par requêtes SQL paramétrées uniquement (politique de sécurité, OWASP A03). */
@Repository
public class ProductRepository {

    private static final String SELECT = """
            select p.id, p.sku, p.name, p.description, p.price_cents, p.currency, c.name as category, p.active,
                   p.exclusive, i.etag as image_etag
            from product p
            left join category c on c.id = p.category_id
            left join product_image i on i.product_id = p.id
            """;

    /** Lettres accentuées ramenées à leur lettre de base, en SQL comme en Java : « epouvante » trouve « Épouvante ». */
    private static final String ACCENTS = "àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæÀÂÄÁÃÅÇÉÈÊËÍÌÎÏÑÓÒÔÖÕÚÙÛÜÝŸŒÆ";
    private static final String SANS_ACCENTS = "aaaaaaceeeeiiiinooooouuuuyyoaaaaaaaceeeeiiiinooooouuuuyyoa";
    private static final String CHERCHE = "translate(lower(%s), :accents, :sansAccents) like :q escape '\\'";

    private final JdbcClient jdbc;

    public ProductRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Produits en vente : filtre par catégorie, gamme exclusive et texte recherché (US22 : nom, description ou
     * référence, sans tenir compte des majuscules ni des accents), dans l'ordre demandé.
     */
    public List<Product> findActive(CatalogFilter filter, ProductSort sort, int page, int size) {
        String sql = SELECT + where(filter) + " order by " + sort.orderBy() + " limit :limit offset :offset";
        return bind(jdbc.sql(sql), filter)
                .param("limit", size)
                .param("offset", (long) page * size)
                .query(ProductRepository::map)
                .list();
    }

    public long countActive(CatalogFilter filter) {
        String sql = "select count(*) from product p left join category c on c.id = p.category_id" + where(filter);
        return bind(jdbc.sql(sql), filter).query(Long.class).single();
    }

    /** Critères du catalogue public ; {@code query} est le texte tel que saisi (null : pas de recherche). */
    public record CatalogFilter(String category, boolean exclusiveOnly, String query) {
    }

    private static String where(CatalogFilter filter) {
        StringBuilder sql = new StringBuilder(" where p.active");
        if (filter.category() != null) {
            sql.append(" and c.name = :category");
        }
        if (filter.exclusiveOnly()) {
            sql.append(" and p.exclusive");
        }
        if (filter.query() != null) {
            sql.append(" and (").append(CHERCHE.formatted("p.name"))
                    .append(" or ").append(CHERCHE.formatted("coalesce(p.description, '')"))
                    .append(" or ").append(CHERCHE.formatted("p.sku")).append(')');
        }
        return sql.toString();
    }

    private static JdbcClient.StatementSpec bind(JdbcClient.StatementSpec statement, CatalogFilter filter) {
        if (filter.category() != null) {
            statement = statement.param("category", filter.category());
        }
        if (filter.query() != null) {
            statement = statement.param("q", "%" + motif(filter.query()) + "%")
                    .param("accents", ACCENTS)
                    .param("sansAccents", SANS_ACCENTS);
        }
        return statement;
    }

    /** Texte recherché en minuscules, sans accents, avec %, _ et l'antislash échappés (cherchés tels quels). */
    static String motif(String query) {
        String simple = Normalizer.normalize(query.strip().toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .replace("œ", "o")
                .replace("æ", "a");
        return simple.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
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

    /** US18 — tous les produits, en vente ou retirés, les plus récents d'abord (administration). */
    public List<Product> findAll(int page, int size) {
        return jdbc.sql(SELECT + " order by p.created_at desc, p.name, p.id limit :limit offset :offset")
                .param("limit", size)
                .param("offset", (long) page * size)
                .query(ProductRepository::map)
                .list();
    }

    public long countAll() {
        return jdbc.sql("select count(*) from product").query(Long.class).single();
    }

    /** Crée un produit ; une référence (SKU) déjà utilisée lève DuplicateKeyException (contrainte d'unicité). */
    public UUID insert(String sku, String name, String description, int priceCents, long categoryId,
            boolean exclusive) {
        return jdbc.sql("""
                insert into product (sku, name, description, price_cents, category_id, exclusive)
                values (:sku, :name, :description, :price, :category, :exclusive)
                returning id
                """)
                .param("sku", sku)
                .param("name", name)
                .param("description", description)
                .param("price", priceCents)
                .param("category", categoryId)
                .param("exclusive", exclusive)
                .query(UUID.class)
                .single();
    }

    /** Met à jour un produit (la référence ne change pas) ; renvoie false s'il n'existe pas. */
    public boolean update(UUID id, String name, String description, int priceCents, long categoryId,
            boolean exclusive, boolean active) {
        return jdbc.sql("""
                update product set name = :name, description = :description, price_cents = :price,
                       category_id = :category, exclusive = :exclusive, active = :active
                where id = :id
                """)
                .param("id", id)
                .param("name", name)
                .param("description", description)
                .param("price", priceCents)
                .param("category", categoryId)
                .param("exclusive", exclusive)
                .param("active", active)
                .update() == 1;
    }

    /** US21 — image d'un produit, si elle existe. */
    public Optional<ProductImage> findImage(UUID productId) {
        return jdbc.sql("select content_type, data, etag from product_image where product_id = :id")
                .param("id", productId)
                .query((rs, row) -> new ProductImage(rs.getString("content_type"), rs.getBytes("data"),
                        rs.getString("etag").strip()))
                .optional();
    }

    /** Remplace l'image d'un produit existant (insertion ou mise à jour). */
    public void saveImage(UUID productId, ImageFormat format, byte[] data, String etag, String author) {
        jdbc.sql("""
                insert into product_image (product_id, content_type, data, size_bytes, etag, updated_by)
                values (:id, :type, :data, :size, :etag, :author)
                on conflict (product_id) do update set content_type = excluded.content_type, data = excluded.data,
                       size_bytes = excluded.size_bytes, etag = excluded.etag, updated_at = now(),
                       updated_by = excluded.updated_by
                """)
                .param("id", productId)
                .param("type", format.mediaType())
                .param("data", data)
                .param("size", data.length)
                .param("etag", etag)
                .param("author", author)
                .update();
    }

    /** Retire l'image d'un produit ; renvoie false s'il n'en avait pas. */
    public boolean deleteImage(UUID productId) {
        return jdbc.sql("delete from product_image where product_id = :id").param("id", productId).update() == 1;
    }

    public boolean exists(UUID id) {
        return jdbc.sql("select count(*) from product where id = :id").param("id", id).query(Long.class).single() > 0;
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
                rs.getBoolean("exclusive"),
                ProductImage.version(rs.getString("image_etag")));
    }
}
