package com.petitemaisonepouvante.catalog.recommendation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** US13 — recommandations personnalisées avec consentement, exclusivités Evil Ed, effacement et conservation. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class RecommendationApiIT {

    private static final String FIGURINE_ORC = "0f6c1a10-0001-4000-8000-000000000001";
    private static final String BLURAY_RESTAURE = "0f6c1a10-0004-4000-8000-000000000004";
    private static final String COFFRET_FESTIVAL = "0f6c1a10-0005-4000-8000-000000000005";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private InterestRetentionTask retention;

    private static String subject() {
        return "membre-" + UUID.randomUUID();
    }

    private static RequestPostProcessor member(String subject) {
        return jwt().jwt(token -> token.subject(subject)).authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"));
    }

    private ResultActions signal(String subject, String body) throws Exception {
        return mvc.perform(post("/api/v1/interests").with(member(subject))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private void consent(String subject, boolean enabled) throws Exception {
        mvc.perform(put("/api/v1/interests/preferences").with(member(subject))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"personalized\":" + enabled + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personalized", is(enabled)));
    }

    private int signals(String subject) {
        return jdbc.queryForObject("select count(*) from interest_signal where member_id = ?", Integer.class, subject);
    }

    @Test
    @DisplayName("Un visiteur reçoit la sélection commune : exclusivités Evil Ed d'abord, sans le produit exclu")
    void selectionCommune() throws Exception {
        mvc.perform(get("/api/v1/recommendations"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personalized", is(false)))
                .andExpect(jsonPath("$.items", hasSize(4)))
                .andExpect(jsonPath("$.items[0].product.exclusive", is(true)))
                .andExpect(jsonPath("$.items[0].reason", startsWith("Exclusivité Evil Ed")));
        mvc.perform(get("/api/v1/recommendations").param("exclude", FIGURINE_ORC))
                .andExpect(jsonPath("$.items[*].product.id", not(hasItem(FIGURINE_ORC))));
    }

    @Test
    @DisplayName("Sans consentement, aucun signal n'est conservé et les recommandations ne sont pas personnalisées")
    void sansConsentement() throws Exception {
        String subject = subject();
        mvc.perform(get("/api/v1/interests/preferences").with(member(subject)))
                .andExpect(jsonPath("$.personalized", is(false)));
        signal(subject, "{\"kind\":\"VIEW\",\"productId\":\"" + BLURAY_RESTAURE + "\"}").andExpect(status().isAccepted());
        assertThat(signals(subject)).isZero();
        mvc.perform(get("/api/v1/recommendations").with(member(subject)))
                .andExpect(jsonPath("$.personalized", is(false)));
    }

    @Test
    @DisplayName("Avec consentement, la catégorie la plus consultée est recommandée, sans les produits déjà achetés")
    void personnalisation() throws Exception {
        String subject = subject();
        consent(subject, true);
        signal(subject, "{\"kind\":\"VIEW\",\"productId\":\"" + BLURAY_RESTAURE + "\"}").andExpect(status().isAccepted());
        signal(subject, "{\"kind\":\"SEARCH\",\"category\":\"Blu-ray\"}").andExpect(status().isAccepted());
        signal(subject, "{\"kind\":\"PURCHASE\",\"productId\":\"" + COFFRET_FESTIVAL + "\"}")
                .andExpect(status().isAccepted());
        signal(subject, "{\"kind\":\"SEARCH\",\"category\":\"Catégorie inconnue\"}").andExpect(status().isAccepted());
        assertThat(signals(subject)).isEqualTo(3);

        mvc.perform(get("/api/v1/recommendations").with(member(subject)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.personalized", is(true)))
                .andExpect(jsonPath("$.items", hasSize(4)))
                .andExpect(jsonPath("$.items[0].product.id", is(BLURAY_RESTAURE)))
                .andExpect(jsonPath("$.items[0].reason", is("Parce que vous vous intéressez à la catégorie « Blu-ray »")))
                .andExpect(jsonPath("$.items[*].product.id", not(hasItem(COFFRET_FESTIVAL))));
        mvc.perform(get("/api/v1/recommendations").with(member(subject)).param("exclude", BLURAY_RESTAURE))
                .andExpect(jsonPath("$.items[*].product.id", not(hasItem(BLURAY_RESTAURE))))
                .andExpect(jsonPath("$.items[*].product.category", everyItem(not(is("Blu-ray")))));
    }

    @Test
    @DisplayName("Le membre efface son historique ; retirer son consentement l'efface aussi")
    void effacement() throws Exception {
        String subject = subject();
        consent(subject, true);
        signal(subject, "{\"kind\":\"VIEW\",\"productId\":\"" + BLURAY_RESTAURE + "\"}");
        mvc.perform(delete("/api/v1/interests").with(member(subject))).andExpect(status().isNoContent());
        assertThat(signals(subject)).isZero();
        signal(subject, "{\"kind\":\"SEARCH\",\"category\":\"Figurines\"}");
        assertThat(signals(subject)).isEqualTo(1);
        consent(subject, false);
        assertThat(signals(subject)).isZero();
    }

    @Test
    @DisplayName("Signal invalide (400), anonyme (401) ou sans profil (403)")
    void refus() throws Exception {
        String subject = subject();
        signal(subject, "{\"kind\":\"VIEW\"}").andExpect(status().isBadRequest());
        signal(subject, "{\"kind\":\"VIEW\",\"productId\":\"" + FIGURINE_ORC + "\",\"category\":\"Figurines\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail", is("Indiquer un produit ou une catégorie (et un seul).")));
        signal(subject, "{\"kind\":\"CLIC\",\"category\":\"Figurines\"}").andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/interests").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/interests/preferences").with(jwt().jwt(token -> token.subject("bob"))))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/interests/preferences").with(member(subject))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Les signaux de plus de 90 jours sont purgés")
    void conservation() {
        jdbc.update("insert into interest_signal (member_id, category_id, kind, created_at) "
                + "select 'ancien', id, 'VIEW', now() - interval '100 days' from category where name = 'Goodies'");
        retention.purge();
        assertThat(signals("ancien")).isZero();
    }

    @Test
    @DisplayName("Le catalogue se filtre sur la gamme exclusive Evil Ed")
    void exclusivites() throws Exception {
        mvc.perform(get("/api/v1/products").param("exclusive", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(2)))
                .andExpect(jsonPath("$.content[*].exclusive", everyItem(is(true))));
        mvc.perform(get("/api/v1/products/{id}", FIGURINE_ORC)).andExpect(jsonPath("$.exclusive", is(true)));
    }
}
