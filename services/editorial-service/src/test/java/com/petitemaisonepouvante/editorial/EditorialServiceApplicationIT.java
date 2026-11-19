package com.petitemaisonepouvante.editorial;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.hamcrest.Matchers;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.petitemaisonepouvante.editorial.web.CorrelationIdFilter;

/** Le service démarre sur PostgreSQL réel, applique ses migrations et expose santé, métriques et corrélation. */
class EditorialServiceApplicationIT extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void lesMigrationsCreentLeSchemaEtLesContenusDeDemonstration() {
        Integer tables = jdbc.queryForObject("""
                select count(*) from information_schema.tables where table_schema = 'public' and table_name in
                ('article', 'issue', 'issue_page', 'entitlement', 'reading_progress', 'subscription',
                 'subscription_event')
                """, Integer.class);
        assertThat(tables).isEqualTo(7);
        assertThat(jdbc.queryForObject("select count(*) from issue_page", Integer.class)).isEqualTo(12);
    }

    @Test
    void laSanteEstUp() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status", Matchers.is("UP")));
    }

    @Test
    void lesMetriquesMetierSontExposees() throws Exception {
        mvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("pme_editorial_issue_purchases_total")))
                .andExpect(content().string(containsString("pme_editorial_subscriptions_total")))
                .andExpect(content().string(containsString("pme_editorial_pages_read_total")))
                .andExpect(content().string(containsString("pme_editorial_articles_published_total")));
    }

    @Test
    void lIdentifiantDeCorrelationEstRenvoye() throws Exception {
        mvc.perform(get("/actuator/health").header(CorrelationIdFilter.HEADER, "it-editorial-1"))
                .andExpect(header().string(CorrelationIdFilter.HEADER, "it-editorial-1"));
    }
}
