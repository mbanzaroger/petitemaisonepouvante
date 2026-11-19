package com.petitemaisonepouvante.editorial.fanzine;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Numéros, pages, achats et progression de lecture ; requêtes SQL paramétrées uniquement. */
@Repository
public class FanzineRepository {

    private static final String SELECT_ISSUE = """
            select i.number, i.title, i.summary, i.published_on, i.price_cents,
                   (select count(*) from issue_page p where p.issue_number = i.number) as page_count
            from issue i
            """;

    private final JdbcClient jdbc;

    public FanzineRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Issue> findIssues() {
        return jdbc.sql(SELECT_ISSUE + " order by i.number desc").query(FanzineRepository::mapIssue).list();
    }

    public Optional<Issue> findIssue(int number) {
        return jdbc.sql(SELECT_ISSUE + " where i.number = :number").param("number", number)
                .query(FanzineRepository::mapIssue).optional();
    }

    /** Sommaire : numéro et titre de chaque page. */
    public List<String> findPageTitles(int number) {
        return jdbc.sql("select title from issue_page where issue_number = :number order by page_no")
                .param("number", number).query(String.class).list();
    }

    public Optional<IssuePage> findPage(int number, int pageNo) {
        return jdbc.sql("select issue_number, page_no, title, content from issue_page "
                        + "where issue_number = :number and page_no = :page")
                .param("number", number)
                .param("page", pageNo)
                .query((rs, row) -> new IssuePage(rs.getInt("issue_number"), rs.getInt("page_no"),
                        rs.getString("title"), rs.getString("content")))
                .optional();
    }

    public boolean owns(String memberId, int number) {
        return jdbc.sql("select count(*) from entitlement where member_id = :member and issue_number = :number")
                .param("member", memberId).param("number", number).query(Long.class).single() > 0;
    }

    /** Numéros achetés par le membre et date d'achat. */
    public Map<Integer, OffsetDateTime> findPurchases(String memberId) {
        return jdbc.sql("select issue_number, purchased_at from entitlement where member_id = :member")
                .param("member", memberId)
                .query((rs, row) -> Map.entry(rs.getInt("issue_number"),
                        rs.getObject("purchased_at", OffsetDateTime.class)))
                .list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    public void insertPurchase(String memberId, int number, int priceCents) {
        jdbc.sql("insert into entitlement (member_id, issue_number, price_cents) values (:member, :number, :price)")
                .param("member", memberId).param("number", number).param("price", priceCents).update();
    }

    public Map<Integer, Integer> findProgress(String memberId) {
        return jdbc.sql("select issue_number, page_no from reading_progress where member_id = :member")
                .param("member", memberId)
                .query((rs, row) -> Map.entry(rs.getInt("issue_number"), rs.getInt("page_no")))
                .list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    public void saveProgress(String memberId, int number, int pageNo) {
        jdbc.sql("""
                insert into reading_progress (member_id, issue_number, page_no) values (:member, :number, :page)
                on conflict (member_id, issue_number) do update set page_no = excluded.page_no, updated_at = now()
                """)
                .param("member", memberId).param("number", number).param("page", pageNo).update();
    }

    private static Issue mapIssue(ResultSet rs, int row) throws SQLException {
        return new Issue(rs.getInt("number"), rs.getString("title"), rs.getString("summary"),
                rs.getObject("published_on", LocalDate.class), rs.getInt("price_cents"), rs.getInt("page_count"));
    }
}
