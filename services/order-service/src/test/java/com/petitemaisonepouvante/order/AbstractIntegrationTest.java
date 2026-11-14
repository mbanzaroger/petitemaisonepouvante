package com.petitemaisonepouvante.order;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.rabbitmq.RabbitMQContainer;

/**
 * Base des tests d'intégration : PostgreSQL et RabbitMQ réels (Testcontainers), démarrés une seule fois
 * et partagés par toutes les classes de test pour limiter la durée du pipeline.
 */
@SpringBootTest(properties = "pme.outbox.delay-ms=200")
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @ServiceConnection
    static final RabbitMQContainer RABBIT = new RabbitMQContainer("rabbitmq:4-alpine");

    static {
        POSTGRES.start();
        RABBIT.start();
    }
}
