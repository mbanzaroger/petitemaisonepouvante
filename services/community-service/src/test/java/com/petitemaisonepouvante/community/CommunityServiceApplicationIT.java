package com.petitemaisonepouvante.community;

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

import com.petitemaisonepouvante.community.web.CorrelationIdFilter;

/** Le service démarre sur PostgreSQL réel, applique ses migrations et expose santé, métriques et corrélation. */
class CommunityServiceApplicationIT extends AbstractIntegrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void lesMigrationsFlywayCreentLeSchemaEtLesSalons() {
        Integer tables = jdbc.queryForObject("""
                select count(*) from information_schema.tables
                where table_schema = 'public' and table_name in ('listing', 'offer', 'room', 'message', 'notification',
                    'notification_preferences', 'wish', 'report')
                """, Integer.class);
        assertThat(tables).isEqualTo(8);
        assertThat(jdbc.queryForObject("select count(*) from room", Integer.class)).isEqualTo(4);
    }

    @Test
    void laSanteEstUp() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", Matchers.is("UP")));
    }

    @Test
    void lesMetriquesMetierSontExposees() throws Exception {
        mvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("pme_community_listings_total")))
                .andExpect(content().string(containsString("pme_community_offers_total")))
                .andExpect(content().string(containsString("pme_community_messages_total")))
                .andExpect(content().string(containsString("pme_community_reports_total")))
                .andExpect(content().string(containsString("pme_community_reports_open")));
    }

    @Test
    void lIdentifiantDeCorrelationEstRenvoye() throws Exception {
        mvc.perform(get("/actuator/health").header(CorrelationIdFilter.HEADER, "it-community-1"))
                .andExpect(header().string(CorrelationIdFilter.HEADER, "it-community-1"));
    }
}
