package com.petitemaisonepouvante.community.moderation;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Signalements, avec un extrait du contenu visé (annonce ou message) ; requêtes SQL paramétrées uniquement. */
@Repository
public class ReportRepository {

    private static final String SELECT = """
            select r.id, r.target_type, r.target_id, coalesce(l.title, m.content) as excerpt,
                   coalesce(l.owner_id, m.author_id) as target_author_id,
                   coalesce(l.owner_name, m.author_name) as target_author_name,
                   r.reporter_name, r.reason, r.status, r.created_at, r.handled_by, r.handled_at
            from report r
            left join listing l on r.target_type = 'LISTING' and l.id::text = r.target_id
            left join message m on r.target_type = 'MESSAGE' and m.id::text = r.target_id
            """;

    private final JdbcClient jdbc;

    public ReportRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Un même membre ne signale qu'une fois un contenu : un nouveau signalement identique est ignoré. */
    public boolean insert(TargetType type, String targetId, String reporterId, String reporterName, String reason) {
        return jdbc.sql("""
                insert into report (id, target_type, target_id, reporter_id, reporter_name, reason)
                values (:id, :type, :target, :reporter, :reporterName, :reason)
                on conflict (target_type, target_id, reporter_id) do nothing
                """)
                .param("id", UUID.randomUUID())
                .param("type", type.name())
                .param("target", targetId)
                .param("reporter", reporterId)
                .param("reporterName", reporterName)
                .param("reason", reason)
                .update() > 0;
    }

    public List<Report> findByStatus(ReportStatus status) {
        return jdbc.sql(SELECT + " where r.status = :status order by r.created_at, r.id limit 200")
                .param("status", status.name())
                .query(ReportRepository::map)
                .list();
    }

    public Optional<Report> findById(UUID id) {
        return jdbc.sql(SELECT + " where r.id = :id").param("id", id).query(ReportRepository::map).optional();
    }

    /** Clôt tous les signalements ouverts sur un même contenu. */
    public int closeOpen(TargetType type, String targetId, ReportStatus status, String handledBy) {
        return jdbc.sql("""
                update report set status = :status, handled_by = :by, handled_at = now()
                where target_type = :type and target_id = :target and status = 'OPEN'
                """)
                .param("status", status.name())
                .param("by", handledBy)
                .param("type", type.name())
                .param("target", targetId)
                .update();
    }

    public void close(UUID id, ReportStatus status, String handledBy) {
        jdbc.sql("update report set status = :status, handled_by = :by, handled_at = now() where id = :id")
                .param("status", status.name())
                .param("by", handledBy)
                .param("id", id)
                .update();
    }

    private static Report map(ResultSet rs, int row) throws SQLException {
        return new Report(
                rs.getObject("id", UUID.class),
                TargetType.valueOf(rs.getString("target_type")),
                rs.getString("target_id"),
                rs.getString("excerpt"),
                rs.getString("target_author_id"),
                rs.getString("target_author_name"),
                rs.getString("reporter_name"),
                rs.getString("reason"),
                ReportStatus.valueOf(rs.getString("status")),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getString("handled_by"),
                rs.getObject("handled_at", OffsetDateTime.class));
    }
}
