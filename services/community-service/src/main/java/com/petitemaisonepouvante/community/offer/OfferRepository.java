package com.petitemaisonepouvante.community.offer;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.petitemaisonepouvante.community.listing.ListingStatus;

/** Persistance des propositions, requêtes SQL paramétrées uniquement. */
@Repository
public class OfferRepository {

    private static final String SELECT = """
            select o.id, o.listing_id, l.title as listing_title, l.owner_id as listing_owner_id,
                   l.owner_name as listing_owner_name, l.status as listing_status, o.author_id, o.author_name,
                   o.message, o.status, o.created_at, o.updated_at
            from offer o join listing l on l.id = o.listing_id
            """;

    private final JdbcClient jdbc;

    public OfferRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID insert(UUID listingId, String authorId, String authorName, String message) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                insert into offer (id, listing_id, author_id, author_name, message)
                values (:id, :listing, :author, :authorName, :message)
                """)
                .param("id", id)
                .param("listing", listingId)
                .param("author", authorId)
                .param("authorName", authorName)
                .param("message", message)
                .update();
        return id;
    }

    public Optional<Offer> findById(UUID id) {
        return jdbc.sql(SELECT + " where o.id = :id").param("id", id).query(OfferRepository::map).optional();
    }

    /** Verrouille la proposition le temps de la transaction (acceptation, refus, annulation concurrents). */
    public Optional<Offer> findByIdForUpdate(UUID id) {
        return jdbc.sql(SELECT + " where o.id = :id for update of o").param("id", id)
                .query(OfferRepository::map).optional();
    }

    public boolean existsPending(UUID listingId, String authorId) {
        return jdbc.sql("select count(*) from offer where listing_id = :listing and author_id = :author "
                        + "and status = 'PENDING'")
                .param("listing", listingId)
                .param("author", authorId)
                .query(Long.class)
                .single() > 0;
    }

    /** Propositions faites ou reçues par le membre, les plus récemment actives d'abord. */
    public List<Offer> findInvolving(String memberId) {
        return jdbc.sql(SELECT + " where o.author_id = :member or l.owner_id = :member "
                        + "order by o.updated_at desc, o.id limit 100")
                .param("member", memberId)
                .query(OfferRepository::map)
                .list();
    }

    public void updateStatus(UUID id, OfferStatus status) {
        jdbc.sql("update offer set status = :status, updated_at = now() where id = :id")
                .param("status", status.name())
                .param("id", id)
                .update();
    }

    /** Fait remonter la proposition dans les listes après un nouveau message. */
    public void touch(UUID id) {
        jdbc.sql("update offer set updated_at = now() where id = :id").param("id", id).update();
    }

    /** Refuse toutes les propositions en attente d'une annonce, sauf celle qui vient d'être acceptée. */
    public List<Offer.Closed> declineAllPending(UUID listingId, UUID except) {
        String sql = "update offer set status = 'DECLINED', updated_at = now() "
                + "where listing_id = :listing and status = 'PENDING'"
                + (except == null ? "" : " and id <> :except")
                + " returning id, author_id";
        JdbcClient.StatementSpec statement = jdbc.sql(sql).param("listing", listingId);
        if (except != null) {
            statement = statement.param("except", except);
        }
        return statement.query((rs, row) -> new Offer.Closed(rs.getObject("id", UUID.class), rs.getString("author_id")))
                .list();
    }

    private static Offer map(ResultSet rs, int row) throws SQLException {
        return new Offer(
                rs.getObject("id", UUID.class),
                rs.getObject("listing_id", UUID.class),
                rs.getString("listing_title"),
                rs.getString("listing_owner_id"),
                rs.getString("listing_owner_name"),
                ListingStatus.valueOf(rs.getString("listing_status")),
                rs.getString("author_id"),
                rs.getString("author_name"),
                rs.getString("message"),
                OfferStatus.valueOf(rs.getString("status")),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class));
    }
}
