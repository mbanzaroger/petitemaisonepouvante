package com.petitemaisonepouvante.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import com.petitemaisonepouvante.order.web.CorrelationIdFilter;

/**
 * Test d'intégration : le service démarre sur un PostgreSQL réel (Testcontainers),
 * applique ses migrations Flyway et expose santé, métriques et corrélation.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Testcontainers
class OrderServiceApplicationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    private final HttpClient http = HttpClient.newHttpClient();

    @LocalServerPort
    private int port;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void lesMigrationsFlywayCreentLeSchema() {
        Integer tables = jdbc.queryForObject(
                "select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('customer_order', 'order_line')",
                Integer.class);
        assertThat(tables).isEqualTo(2);
    }

    @Test
    void laSanteEstUp() throws Exception {
        HttpResponse<String> response = get("/actuator/health", null);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("\"status\":\"UP\"");
    }

    @Test
    void lesMetriquesPrometheusSontExposees() throws Exception {
        HttpResponse<String> response = get("/actuator/prometheus", null);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(response.body()).contains("jvm_memory_used_bytes");
    }

    @Test
    void lIdentifiantDeCorrelationEstRenvoye() throws Exception {
        HttpResponse<String> response = get("/actuator/health", "it-order-1");
        assertThat(response.headers().firstValue(CorrelationIdFilter.HEADER)).hasValue("it-order-1");
    }

    private HttpResponse<String> get(String path, String correlationId) throws IOException, InterruptedException {
        HttpRequest.Builder request = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).GET();
        if (correlationId != null) {
            request.header(CorrelationIdFilter.HEADER, correlationId);
        }
        return http.send(request.build(), HttpResponse.BodyHandlers.ofString());
    }
}
