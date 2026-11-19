package com.petitemaisonepouvante.catalog.product;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import tools.jackson.databind.json.JsonMapper;

/** US18 — gestion des produits par l'administrateur, sur une base dédiée (les comptages d'US1 ne bougent pas). */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AdminProductApiIT {

    private static final String API = "/api/v1/catalog/admin/products";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JsonMapper json;

    private static RequestPostProcessor administrator() {
        return jwt().jwt(token -> token.claim("preferred_username", "admin-pme"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private static RequestPostProcessor customer() {
        return jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"));
    }

    private static String sku() {
        return "TST-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    private static String creation(String sku, String category, int price) {
        return """
                {"sku":"%s","name":"  Figurine Evil Ed de test  ","description":"Résine, 18 cm.",
                 "priceCents":%d,"category":"%s","exclusive":true}
                """.formatted(sku, price, category);
    }

    private String create(String sku) throws Exception {
        String body = mvc.perform(post(API).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(creation(sku, "Figurines", 4590)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asString();
    }

    @Test
    @DisplayName("US18 — L'administrateur crée un produit : il est aussitôt en vente dans le catalogue public")
    void creation() throws Exception {
        String sku = sku();
        String body = mvc.perform(post(API).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(creation(sku, "Figurines", 4590)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith("/api/v1/products/")))
                .andExpect(jsonPath("$.sku", is(sku)))
                .andExpect(jsonPath("$.name", is("Figurine Evil Ed de test")))
                .andExpect(jsonPath("$.price.amountCents", is(4590)))
                .andExpect(jsonPath("$.price.currency", is("EUR")))
                .andExpect(jsonPath("$.category", is("Figurines")))
                .andExpect(jsonPath("$.exclusive", is(true)))
                .andExpect(jsonPath("$.available", is(true)))
                .andReturn().getResponse().getContentAsString();
        String id = json.readTree(body).get("id").asString();

        mvc.perform(get("/api/v1/products/{id}", id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.description", is("Résine, 18 cm.")));
        mvc.perform(get("/api/v1/products").param("category", "Figurines").param("size", "100"))
                .andExpect(jsonPath("$.content[*].sku", hasItem(sku)));
        mvc.perform(get(API).with(administrator()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].sku", is(sku)));
    }

    @Test
    @DisplayName("US18 — Référence déjà utilisée (409), catégorie inconnue ou données invalides (400)")
    void controles() throws Exception {
        String sku = sku();
        create(sku);
        mvc.perform(post(API).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(creation(sku, "Figurines", 4590)))
                .andExpect(status().isConflict());
        mvc.perform(post(API).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(creation(sku(), "Catégorie inexistante", 4590)))
                .andExpect(status().isBadRequest());
        mvc.perform(post(API).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(creation("minuscules interdites", "Figurines", 4590)))
                .andExpect(status().isBadRequest());
        mvc.perform(post(API).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(creation(sku(), "Figurines", 0)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("US18 — Retiré de la vente, un produit disparaît du catalogue public puis y revient")
    void retraitEtRemiseEnVente() throws Exception {
        String sku = sku();
        String id = create(sku);
        String retrait = """
                {"name":"Figurine retirée","description":"","priceCents":3990,"category":"Goodies",
                 "exclusive":false,"active":false}
                """;
        mvc.perform(put(API + "/{id}", id).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(retrait))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available", is(false)))
                .andExpect(jsonPath("$.category", is("Goodies")))
                .andExpect(jsonPath("$.price.amountCents", is(3990)))
                .andExpect(jsonPath("$.sku", is(sku)));
        mvc.perform(get("/api/v1/products").param("size", "100"))
                .andExpect(jsonPath("$.content[*].sku", not(hasItem(sku))));

        mvc.perform(put(API + "/{id}", id).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(retrait.replace("\"active\":false", "\"active\":true")))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/products").param("size", "100"))
                .andExpect(jsonPath("$.content[*].sku", hasItem(sku)));
        mvc.perform(put(API + "/{id}", UUID.randomUUID()).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content(retrait))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("US18 — La gestion des produits est refusée à un client (403) et à un visiteur (401)")
    void reserveAdministrateur() throws Exception {
        mvc.perform(post(API).with(customer()).contentType(MediaType.APPLICATION_JSON)
                        .content(creation(sku(), "Figurines", 4590)))
                .andExpect(status().isForbidden());
        mvc.perform(get(API).with(customer())).andExpect(status().isForbidden());
        mvc.perform(post(API).contentType(MediaType.APPLICATION_JSON).content(creation(sku(), "Figurines", 4590)))
                .andExpect(status().isUnauthorized());
    }
}
