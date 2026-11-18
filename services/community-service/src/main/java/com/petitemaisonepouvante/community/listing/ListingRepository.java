package com.petitemaisonepouvante.community.listing;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Persistance des annonces, requêtes SQL paramétrées uniquement (politique de sécurité, OWASP A03). */
@Repository
public class ListingRepository {

    private static final String COLUMNS = "id, owner_id, owner_name, type, title, description, category, "
            + "item_condition, wanted, status, created_at, updated_at";

    private final JdbcClient jdbc;

    public ListingRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Listing insert(String ownerId, String ownerName, ListingType type, String title, String description,
            Category category, ItemCondition condition, String wanted) {
        return jdbc.sql("insert into listing (id, owner_id, owner_name, type, title, description, category, "
                        + "item_condition, wanted) values (:id, :owner, :ownerName, :type, :title, :description, "
                        + ":category, :condition, :wanted) returning " + COLUMNS)
                .param("id", UUID.randomUUID())
                .param("owner", ownerId)
                .param("ownerName", ownerName)
                .param("type", type.name())
                .param("title", title)
                .param("description", description)
                .param("category", category.name())
                .param("condition", condition.name())
                .param("wanted", wanted)
                .query(ListingRepository::map)
                .single();
    }

    public Optional<Listing> findById(UUID id) {
        return jdbc.sql("select " + COLUMNS + " from listing where id = :id").param("id", id)
                .query(ListingRepository::map).optional();
    }

    /** Verrouille l'annonce le temps de la transaction (proposition, acceptation, retrait concurrents). */
    public Optional<Listing> findByIdForUpdate(UUID id) {
        return jdbc.sql("select " + COLUMNS + " from listing where id = :id for update").param("id", id)
                .query(ListingRepository::map).optional();
    }

    public List<Listing> findActive(ListingType type, Category category, String text, int page, int size) {
        Map<String, Object> params = new HashMap<>();
        String where = activeFilter(type, category, text, params);
        params.put("limit", size);
        params.put("offset", (long) page * size);
        return jdbc.sql("select " + COLUMNS + " from listing" + where
                        + " order by created_at desc, id limit :limit offset :offset")
                .params(params)
                .query(ListingRepository::map)
                .list();
    }

    public long countActive(ListingType type, Category category, String text) {
        Map<String, Object> params = new HashMap<>();
        String where = activeFilter(type, category, text, params);
        return jdbc.sql("select count(*) from listing" + where).params(params).query(Long.class).single();
    }

    public List<Listing> findByOwner(String ownerId) {
        return jdbc.sql("select " + COLUMNS + " from listing where owner_id = :owner order by created_at desc, id")
                .param("owner", ownerId)
                .query(ListingRepository::map)
                .list();
    }

    public void updateStatus(UUID id, ListingStatus status) {
        jdbc.sql("update listing set status = :status, updated_at = now() where id = :id")
                .param("status", status.name())
                .param("id", id)
                .update();
    }

    /** Recherche plein texte simple (titre, description) : les caractères spéciaux de LIKE sont neutralisés. */
    private static String activeFilter(ListingType type, Category category, String text, Map<String, Object> params) {
        StringBuilder where = new StringBuilder(" where status = 'ACTIVE'");
        if (type != null) {
            where.append(" and type = :type");
            params.put("type", type.name());
        }
        if (category != null) {
            where.append(" and category = :category");
            params.put("category", category.name());
        }
        if (text != null && !text.isBlank()) {
            where.append(" and (title ilike :text or description ilike :text)");
            params.put("text", "%" + escapeLike(text.strip()) + "%");
        }
        return where.toString();
    }

    static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static Listing map(ResultSet rs, int row) throws SQLException {
        return new Listing(
                rs.getObject("id", UUID.class),
                rs.getString("owner_id"),
                rs.getString("owner_name"),
                ListingType.valueOf(rs.getString("type")),
                rs.getString("title"),
                rs.getString("description"),
                Category.valueOf(rs.getString("category")),
                ItemCondition.valueOf(rs.getString("item_condition")),
                rs.getString("wanted"),
                ListingStatus.valueOf(rs.getString("status")),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class));
    }
}
