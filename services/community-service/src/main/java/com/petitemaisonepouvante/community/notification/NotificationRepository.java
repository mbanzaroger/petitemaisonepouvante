package com.petitemaisonepouvante.community.notification;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Notifications, préférences et objets recherchés des membres ; requêtes SQL paramétrées uniquement. */
@Repository
public class NotificationRepository {

    private final JdbcClient jdbc;

    public NotificationRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // --- Notifications ---

    public void insert(String memberId, NotificationType type, String text, String link) {
        jdbc.sql("insert into notification (member_id, type, text, link) values (:member, :type, :text, :link)")
                .param("member", memberId)
                .param("type", type.name())
                .param("text", text)
                .param("link", link)
                .update();
    }

    public boolean existsUnread(String memberId, NotificationType type, String link) {
        return jdbc.sql("select count(*) from notification where member_id = :member and type = :type "
                        + "and link = :link and not is_read")
                .param("member", memberId)
                .param("type", type.name())
                .param("link", link)
                .query(Long.class)
                .single() > 0;
    }

    public List<Notification> findLatest(String memberId, int limit) {
        return jdbc.sql("select id, type, text, link, is_read, created_at from notification where member_id = :member "
                        + "order by id desc limit :limit")
                .param("member", memberId)
                .param("limit", limit)
                .query((rs, row) -> new Notification(rs.getLong("id"), NotificationType.valueOf(rs.getString("type")),
                        rs.getString("text"), rs.getString("link"), rs.getBoolean("is_read"),
                        rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    public long countUnread(String memberId) {
        return jdbc.sql("select count(*) from notification where member_id = :member and not is_read")
                .param("member", memberId).query(Long.class).single();
    }

    public void markAllRead(String memberId) {
        jdbc.sql("update notification set is_read = true where member_id = :member and not is_read")
                .param("member", memberId).update();
    }

    /** Durée de conservation (RGPD) : notifications lues de plus de {@code days} jours. */
    public int deleteReadOlderThan(int days) {
        return jdbc.sql("delete from notification where is_read and created_at < now() - make_interval(days => :days)")
                .param("days", days).update();
    }

    // --- Préférences ---

    public Preferences findPreferences(String memberId) {
        return jdbc.sql("select offers, messages, wishes from notification_preferences where member_id = :member")
                .param("member", memberId)
                .query((rs, row) -> new Preferences(rs.getBoolean("offers"), rs.getBoolean("messages"),
                        rs.getBoolean("wishes")))
                .optional()
                .orElse(Preferences.DEFAULT);
    }

    public void savePreferences(String memberId, Preferences preferences) {
        jdbc.sql("""
                insert into notification_preferences (member_id, offers, messages, wishes)
                values (:member, :offers, :messages, :wishes)
                on conflict (member_id) do update
                set offers = excluded.offers, messages = excluded.messages, wishes = excluded.wishes,
                    updated_at = now()
                """)
                .param("member", memberId)
                .param("offers", preferences.offers())
                .param("messages", preferences.messages())
                .param("wishes", preferences.wishes())
                .update();
    }

    // --- Objets recherchés ---

    public List<Wish> findWishes(String memberId) {
        return jdbc.sql("select id, keywords, created_at from wish where member_id = :member order by created_at, id")
                .param("member", memberId)
                .query((rs, row) -> new Wish(rs.getObject("id", UUID.class), rs.getString("keywords"),
                        rs.getObject("created_at", OffsetDateTime.class)))
                .list();
    }

    /** @return l'objet recherché créé, vide s'il existait déjà pour ce membre */
    public Optional<Wish> insertWish(String memberId, String keywords) {
        return jdbc.sql("""
                insert into wish (id, member_id, keywords) values (:id, :member, :keywords)
                on conflict (member_id, lower(keywords)) do nothing
                returning id, keywords, created_at
                """)
                .param("id", UUID.randomUUID())
                .param("member", memberId)
                .param("keywords", keywords)
                .query((rs, row) -> new Wish(rs.getObject("id", UUID.class), rs.getString("keywords"),
                        rs.getObject("created_at", OffsetDateTime.class)))
                .optional();
    }

    public long countWishes(String memberId) {
        return jdbc.sql("select count(*) from wish where member_id = :member").param("member", memberId)
                .query(Long.class).single();
    }

    public boolean deleteWish(UUID id, String memberId) {
        return jdbc.sql("delete from wish where id = :id and member_id = :member")
                .param("id", id).param("member", memberId).update() > 0;
    }

    /**
     * Membres (hors auteur) dont un objet recherché apparaît dans le texte de l'annonce, et le premier mot-clé
     * correspondant. Comparaison insensible à la casse ; une seule ligne par membre.
     */
    public List<WishMatch> findWishMatches(String text, String excludedMemberId) {
        return jdbc.sql("""
                select distinct on (member_id) member_id, keywords from wish
                where member_id <> :excluded and position(lower(keywords) in lower(:text)) > 0
                order by member_id, created_at
                """)
                .param("excluded", excludedMemberId)
                .param("text", text)
                .query((rs, row) -> new WishMatch(rs.getString("member_id"), rs.getString("keywords")))
                .list();
    }

    /** Correspondance entre une annonce et l'objet recherché d'un membre. */
    public record WishMatch(String memberId, String keywords) {
    }
}
