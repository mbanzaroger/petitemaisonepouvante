package com.petitemaisonepouvante.community.chat;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Persistance des salons et des messages, requêtes SQL paramétrées uniquement. */
@Repository
public class MessageRepository {

    private static final String COLUMNS = "id, room_code, offer_id, author_id, author_name, content, hidden, sent_at";

    private final JdbcClient jdbc;

    public MessageRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Room> findRooms() {
        return jdbc.sql("select code, name, description from room order by sort_order, code")
                .query((rs, row) -> new Room(rs.getString("code"), rs.getString("name"), rs.getString("description")))
                .list();
    }

    public boolean roomExists(String code) {
        return jdbc.sql("select count(*) from room where code = :code").param("code", code)
                .query(Long.class).single() > 0;
    }

    public ChatMessage insertInRoom(String roomCode, String authorId, String authorName, String content) {
        return jdbc.sql("insert into message (room_code, author_id, author_name, content) "
                        + "values (:key, :author, :authorName, :content) returning " + COLUMNS)
                .param("key", roomCode)
                .param("author", authorId)
                .param("authorName", authorName)
                .param("content", content)
                .query(MessageRepository::map)
                .single();
    }

    public ChatMessage insertInOffer(UUID offerId, String authorId, String authorName, String content) {
        return jdbc.sql("insert into message (offer_id, author_id, author_name, content) "
                        + "values (:key, :author, :authorName, :content) returning " + COLUMNS)
                .param("key", offerId)
                .param("author", authorId)
                .param("authorName", authorName)
                .param("content", content)
                .query(MessageRepository::map)
                .single();
    }

    /** Premier appel ({@code after} = 0) : les derniers messages ; ensuite, ceux publiés après le curseur. */
    public List<ChatMessage> findInRoom(String code, long after, int limit) {
        return find("room_code = :key", code, after, limit);
    }

    public List<ChatMessage> findInOffer(UUID offerId, long after, int limit) {
        return find("offer_id = :key", offerId, after, limit);
    }

    public Optional<ChatMessage> findById(long id) {
        return jdbc.sql("select " + COLUMNS + " from message where id = :id").param("id", id)
                .query(MessageRepository::map).optional();
    }

    public void hide(long id) {
        jdbc.sql("update message set hidden = true where id = :id").param("id", id).update();
    }

    /** Messages envoyés par le membre depuis {@code seconds} secondes (limitation anti-flood). */
    public long countRecentByAuthor(String authorId, int seconds) {
        return jdbc.sql("select count(*) from message where author_id = :author "
                        + "and sent_at > now() - make_interval(secs => :seconds)")
                .param("author", authorId)
                .param("seconds", seconds)
                .query(Long.class)
                .single();
    }

    /** Durée de conservation (RGPD) : les messages des salons plus anciens que {@code days} jours sont supprimés. */
    public int deleteRoomMessagesOlderThan(int days) {
        return jdbc.sql("delete from message where room_code is not null and sent_at < now() - make_interval(days => :days)")
                .param("days", days)
                .update();
    }

    private List<ChatMessage> find(String condition, Object key, long after, int limit) {
        String sql = after > 0
                ? "select " + COLUMNS + " from message where " + condition
                        + " and not hidden and id > :after order by id limit :limit"
                : "select * from (select " + COLUMNS + " from message where " + condition
                        + " and not hidden order by id desc limit :limit) recent order by id";
        JdbcClient.StatementSpec statement = jdbc.sql(sql).param("key", key).param("limit", limit);
        if (after > 0) {
            statement = statement.param("after", after);
        }
        return statement.query(MessageRepository::map).list();
    }

    private static ChatMessage map(ResultSet rs, int row) throws SQLException {
        return new ChatMessage(
                rs.getLong("id"),
                rs.getString("room_code"),
                rs.getObject("offer_id", UUID.class),
                rs.getString("author_id"),
                rs.getString("author_name"),
                rs.getString("content"),
                rs.getBoolean("hidden"),
                rs.getObject("sent_at", OffsetDateTime.class));
    }
}
