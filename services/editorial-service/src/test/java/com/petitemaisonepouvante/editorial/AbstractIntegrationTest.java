package com.petitemaisonepouvante.editorial;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;

import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Base des tests d'intégration : PostgreSQL réel (Testcontainers) démarré une fois et partagé par toutes les
 * classes. Chaque test crée ses propres membres (noms uniques) pour rester indépendant des autres.
 */
@SpringBootTest
@AutoConfigureMockMvc
public abstract class AbstractIntegrationTest {

    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    static {
        POSTGRES.start();
    }

    @Autowired
    protected MockMvc mvc;

    @Autowired
    protected JsonMapper json;

    /** Nom de membre unique pour le test en cours (préfixe lisible). */
    protected static String unique(String name) {
        return name + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    protected static RequestPostProcessor member(String name) {
        return jwt().jwt(token -> token.subject("sub-" + name).claim("preferred_username", name))
                .authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"));
    }

    protected static RequestPostProcessor admin(String name) {
        return jwt().jwt(token -> token.subject("sub-" + name).claim("preferred_username", name))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    /** Compte authentifié sans rôle (comme bob) : refusé partout (403). */
    protected static RequestPostProcessor withoutRole(String name) {
        return jwt().jwt(token -> token.subject("sub-" + name).claim("preferred_username", name));
    }

    protected String body(Object value) {
        return json.writeValueAsString(value);
    }

    protected JsonNode read(String content) {
        return json.readTree(content);
    }
}
