package com.petitemaisonepouvante.community;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
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

    /** Publie une annonce d'échange et renvoie son identifiant. */
    protected String publish(RequestPostProcessor owner, String title) throws Exception {
        String response = mvc.perform(post("/api/v1/community/listings").with(owner)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("type", "EXCHANGE", "title", title,
                                "description", "Objet en très bon état, avec sa boîte d'origine.",
                                "category", "FIGURINES", "condition", "LIKE_NEW",
                                "wanted", "Un Blu-ray collector"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return read(response).get("id").asString();
    }

    /** Fait une proposition sur une annonce et renvoie son identifiant. */
    protected String offer(RequestPostProcessor author, String listingId, String message) throws Exception {
        String response = mvc.perform(post("/api/v1/community/listings/{id}/offers", listingId).with(author)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("message", message))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return read(response).get("id").asString();
    }

    protected long unread(RequestPostProcessor who) throws Exception {
        String response = mvc.perform(get("/api/v1/community/notifications/unread-count").with(who))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        return read(response).get("unread").asLong();
    }

    protected JsonNode notifications(RequestPostProcessor who) throws Exception {
        return read(mvc.perform(get("/api/v1/community/notifications").with(who))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
    }
}
