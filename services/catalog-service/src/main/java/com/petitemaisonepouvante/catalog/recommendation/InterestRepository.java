package com.petitemaisonepouvante.catalog.recommendation;

import java.util.List;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Consentement à la personnalisation et signaux d'intérêt des membres ; requêtes SQL paramétrées uniquement. */
@Repository
public class InterestRepository {

    private final JdbcClient jdbc;

    public InterestRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean isEnabled(String memberId) {
        return jdbc.sql("select enabled from personalization where member_id = :member").param("member", memberId)
                .query(Boolean.class).optional().orElse(false);
    }

    public void setEnabled(String memberId, boolean enabled) {
        jdbc.sql("""
                insert into personalization (member_id, enabled) values (:member, :enabled)
                on conflict (member_id) do update set enabled = excluded.enabled, updated_at = now()
                """)
                .param("member", memberId)
                .param("enabled", enabled)
                .update();
    }

    public void insertCategorySignal(String memberId, long categoryId, InterestKind kind) {
        jdbc.sql("insert into interest_signal (member_id, category_id, kind) values (:member, :category, :kind)")
                .param("member", memberId)
                .param("category", categoryId)
                .param("kind", kind.name())
                .update();
    }

    public void insertProductSignal(String memberId, long categoryId, UUID productId, InterestKind kind) {
        jdbc.sql("""
                insert into interest_signal (member_id, category_id, product_id, kind)
                values (:member, :category, :product, :kind)
                """)
                .param("member", memberId)
                .param("category", categoryId)
                .param("product", productId)
                .param("kind", kind.name())
                .update();
    }

    public long countSince(String memberId, int hours) {
        return jdbc.sql("select count(*) from interest_signal where member_id = :member "
                        + "and created_at > now() - make_interval(hours => :hours)")
                .param("member", memberId)
                .param("hours", hours)
                .query(Long.class)
                .single();
    }

    /** Catégories les plus marquées sur la période (score pondéré), de la plus forte à la plus faible. */
    public List<CategoryScore> topCategories(String memberId, int days, int limit) {
        return jdbc.sql("""
                select s.category_id, c.name,
                       sum(case s.kind when 'VIEW' then 1 when 'SEARCH' then 2 else 4 end) as score
                from interest_signal s join category c on c.id = s.category_id
                where s.member_id = :member and s.created_at > now() - make_interval(days => :days)
                group by s.category_id, c.name
                order by score desc, c.name
                limit :limit
                """)
                .param("member", memberId)
                .param("days", days)
                .param("limit", limit)
                .query((rs, row) -> new CategoryScore(rs.getLong("category_id"), rs.getString("name"),
                        rs.getLong("score")))
                .list();
    }

    public List<UUID> purchasedProducts(String memberId) {
        return jdbc.sql("select distinct product_id from interest_signal where member_id = :member "
                        + "and kind = 'PURCHASE' and product_id is not null")
                .param("member", memberId)
                .query(UUID.class)
                .list();
    }

    public int deleteAll(String memberId) {
        return jdbc.sql("delete from interest_signal where member_id = :member").param("member", memberId).update();
    }

    /** Durée de conservation (RGPD) : signaux de plus de {@code days} jours. */
    public int deleteOlderThan(int days) {
        return jdbc.sql("delete from interest_signal where created_at < now() - make_interval(days => :days)")
                .param("days", days)
                .update();
    }

    /** Score d'intérêt d'un membre pour une catégorie. */
    public record CategoryScore(long categoryId, String name, long score) {
    }
}
