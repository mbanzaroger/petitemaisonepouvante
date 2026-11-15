package com.petitemaisonepouvante.stock;

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
import org.springframework.test.web.servlet.MockMvc;

import com.petitemaisonepouvante.stock.web.CorrelationIdFilter;

/** Le service démarre sur PostgreSQL et RabbitMQ réels, applique ses migrations et expose santé, métriques et corrélation. */
class StockServiceApplicationIT extends AbstractIntegrationTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void lesMigrationsFlywayCreentLeSchema() {
        Integer tables = jdbc.queryForObject("""
                select count(*) from information_schema.tables
                where table_schema = 'public' and table_name in ('stock_item', 'stock_reservation', 'processed_event', 'outbox_event')
                """, Integer.class);
        assertThat(tables).isEqualTo(4);
    }

    @Test
    void laSanteEstUpAvecBaseEtBroker() throws Exception {
        mvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", Matchers.is("UP")));
    }

    @Test
    void lesMetriquesPrometheusSontExposees() throws Exception {
        mvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("jvm_memory_used_bytes")))
                .andExpect(content().string(containsString("pme_stock_reservations_total")))
                .andExpect(content().string(containsString("pme_outbox_pending")));
    }

    @Test
    void lIdentifiantDeCorrelationEstRenvoye() throws Exception {
        mvc.perform(get("/actuator/health").header(CorrelationIdFilter.HEADER, "it-stock-1"))
                .andExpect(header().string(CorrelationIdFilter.HEADER, "it-stock-1"));
    }
}
