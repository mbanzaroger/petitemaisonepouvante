package com.petitemaisonepouvante.catalog.product;

import static org.hamcrest.Matchers.containsStringIgnoringCase;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.startsWith;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

/** US1 — critères d'acceptation vérifiés sur une base PostgreSQL réelle avec les données de démonstration. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ProductApiIT {

    private static final String FIGURINE_ORC = "0f6c1a10-0001-4000-8000-000000000001";
    private static final String AFFICHE_EPUISEE = "0f6c1a10-0012-4000-8000-000000000012";

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRES = new PostgreSQLContainer("postgres:16-alpine");

    @Autowired
    private MockMvc mvc;

    @Test
    @DisplayName("Étant donné des produits en base, quand un visiteur liste le catalogue, alors il obtient une page avec prix et disponibilité")
    void listePaginee() throws Exception {
        mvc.perform(get("/api/v1/products").param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(5)))
                .andExpect(jsonPath("$.page", is(0)))
                .andExpect(jsonPath("$.size", is(5)))
                .andExpect(jsonPath("$.totalElements", is(11)))
                .andExpect(jsonPath("$.totalPages", is(3)))
                .andExpect(jsonPath("$.content[0].price.amountCents").isNumber())
                .andExpect(jsonPath("$.content[0].price.currency", is("EUR")))
                .andExpect(jsonPath("$.content[*].available", everyItem(is(true))));
    }

    @Test
    @DisplayName("Un produit retiré de la vente n'apparaît pas dans le catalogue")
    void produitInactifMasque() throws Exception {
        mvc.perform(get("/api/v1/products").param("size", "100"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].id", not(hasItem(AFFICHE_EPUISEE))));
    }

    @Test
    @DisplayName("Le filtre par catégorie ne renvoie que la catégorie demandée")
    void filtreCategorie() throws Exception {
        mvc.perform(get("/api/v1/products").param("category", "Figurines"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(3)))
                .andExpect(jsonPath("$.content[*].category", everyItem(is("Figurines"))));
    }

    @Test
    @DisplayName("US22 — La recherche porte sur le nom, la description et la référence, sans majuscules ni accents")
    void recherche() throws Exception {
        mvc.perform(get("/api/v1/products").param("q", "ORC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(3)))
                .andExpect(jsonPath("$.content[*].name", everyItem(containsStringIgnoringCase("orc"))));
        mvc.perform(get("/api/v1/products").param("q", "epouvante"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(2)))
                .andExpect(jsonPath("$.content[*].name", everyItem(containsStringIgnoringCase("Épouvante"))));
        mvc.perform(get("/api/v1/products").param("q", "orc").param("category", "Bandes dessinées"))
                .andExpect(jsonPath("$.totalElements", is(1)));
        mvc.perform(get("/api/v1/products").param("q", "   "))
                .andExpect(jsonPath("$.totalElements", is(11)));
    }

    @Test
    @DisplayName("US22 — Les caractères spéciaux de LIKE sont cherchés tels quels")
    void rechercheEchappee() throws Exception {
        mvc.perform(get("/api/v1/products").param("q", "%"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(0)));
        mvc.perform(get("/api/v1/products").param("q", "_"))
                .andExpect(jsonPath("$.totalElements", is(0)));
        mvc.perform(get("/api/v1/products").param("q", "x".repeat(101))).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("US22 — Le catalogue se trie par prix croissant ou décroissant ; un tri inconnu est refusé (400)")
    void tri() throws Exception {
        mvc.perform(get("/api/v1/products").param("sort", "price-asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].price.amountCents", is(690)));
        mvc.perform(get("/api/v1/products").param("sort", "price-desc"))
                .andExpect(jsonPath("$.content[0].price.amountCents", is(12900)));
        mvc.perform(get("/api/v1/products").param("sort", "newest")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/products").param("sort", "price; drop table product"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("US21 — Chaque produit de démonstration a une image, à une adresse versionnée")
    void imagesDeDemonstration() throws Exception {
        mvc.perform(get("/api/v1/products").param("size", "100"))
                .andExpect(jsonPath("$.content[*].imageUrl", everyItem(startsWith("/api/v1/products/"))));
    }

    @Test
    @DisplayName("Quand un visiteur consulte un produit existant, alors il obtient sa fiche")
    void ficheProduit() throws Exception {
        mvc.perform(get("/api/v1/products/{id}", FIGURINE_ORC))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sku", is("FIG-ORC-001")))
                .andExpect(jsonPath("$.price.amountCents", is(5990)))
                .andExpect(jsonPath("$.category", is("Figurines")));
    }

    @Test
    @DisplayName("Étant donné un identifiant inconnu, alors la réponse est 404 au format problem+json")
    void produitInconnu() throws Exception {
        mvc.perform(get("/api/v1/products/{id}", "7d1e1f00-0000-4000-8000-000000000999"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status", is(404)));
    }

    @Test
    @DisplayName("Des paramètres hors bornes ou mal formés sont refusés (400)")
    void parametresInvalides() throws Exception {
        mvc.perform(get("/api/v1/products").param("size", "500")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/products").param("page", "-1")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/products/{id}", "pas-un-uuid")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("La lecture groupée par identifiants renvoie les produits demandés, y compris leur disponibilité")
    void lectureGroupee() throws Exception {
        mvc.perform(get("/api/v1/products").param("ids", FIGURINE_ORC + "," + AFFICHE_EPUISEE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[?(@.id == '" + AFFICHE_EPUISEE + "')].available", hasItem(false)));
    }

    @Test
    @DisplayName("Les catégories sont listées par ordre alphabétique")
    void categories() throws Exception {
        mvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[0]", is("Bandes dessinées")));
    }

    @Test
    @DisplayName("Une écriture sans jeton est refusée (401) ; un client authentifié n'a pas d'opération d'écriture (405)")
    void ecritureProtegee() throws Exception {
        mvc.perform(post("/api/v1/products").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/products").with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER")))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isMethodNotAllowed());
    }

    @Test
    @DisplayName("Les en-têtes de sécurité sont présents sur les réponses de l'API")
    void entetesDeSecurite() throws Exception {
        mvc.perform(get("/api/v1/categories"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"));
    }
}
