package com.petitemaisonepouvante.catalog.product;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
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

/** US21 — images des produits : lecture publique, ajout, remplacement et retrait par l'administrateur. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class ProductImageApiIT {

    private static final String ADMIN = "/api/v1/catalog/admin/products";
    private static final String MUG = "0f6c1a10-0008-4000-8000-000000000008";
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0, 0, 0, 13, 'I', 'H', 'D',
        'R', 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0};

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

    private String nouveauProduit() throws Exception {
        String sku = "IMG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String body = mvc.perform(post(ADMIN).with(administrator()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"sku":"%s","name":"Produit sans image","priceCents":990,"category":"Goodies",
                                 "exclusive":false}
                                """.formatted(sku)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.imageUrl", nullValue()))
                .andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("id").asString();
    }

    @Test
    @DisplayName("US21 — L'image d'un produit est publique, typée, mise en cache et protégée contre l'interprétation")
    void lecturePublique() throws Exception {
        String url = json.readTree(mvc.perform(get("/api/v1/products/{id}", MUG)).andReturn().getResponse()
                .getContentAsString()).get("imageUrl").asString();
        String etag = mvc.perform(get(url))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/webp"))
                .andExpect(header().string("Cache-Control", containsString("immutable")))
                .andExpect(header().string("Content-Security-Policy", "default-src 'none'; sandbox"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn().getResponse().getHeader("ETag");
        mvc.perform(get(url).header("If-None-Match", etag)).andExpect(status().isNotModified());
        mvc.perform(get("/api/v1/products/{id}/image", MUG).param("v", "perimee"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-cache")));
    }

    @Test
    @DisplayName("US21 — L'administrateur ajoute, remplace puis retire l'image d'un produit")
    void cycleDeVie() throws Exception {
        String id = nouveauProduit();
        mvc.perform(get("/api/v1/products/{id}/image", id)).andExpect(status().isNotFound());

        mvc.perform(put(ADMIN + "/{id}/image", id).with(administrator()).contentType("image/png").content(PNG))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.imageUrl", startsWith("/api/v1/products/" + id + "/image?v=")));
        mvc.perform(get("/api/v1/products/{id}/image", id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/png"))
                .andExpect(content().bytes(PNG));

        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 16, 'J', 'F', 'I', 'F', 0};
        mvc.perform(put(ADMIN + "/{id}/image", id).with(administrator()).contentType("image/jpeg").content(jpeg))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/products/{id}/image", id)).andExpect(content().contentType("image/jpeg"));

        mvc.perform(delete(ADMIN + "/{id}/image", id).with(administrator())).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/products/{id}/image", id)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/products/{id}", id)).andExpect(jsonPath("$.imageUrl", nullValue()));
    }

    @Test
    @DisplayName("US21 — Seules les vraies images JPEG, PNG ou WebP de 2 Mo au plus sont acceptées")
    void controleDuContenu() throws Exception {
        String id = nouveauProduit();
        byte[] html = "<html><script>alert(1)</script></html>".getBytes(StandardCharsets.UTF_8);
        mvc.perform(put(ADMIN + "/{id}/image", id).with(administrator()).contentType("image/png").content(html))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mvc.perform(put(ADMIN + "/{id}/image", id).with(administrator()).contentType("image/jpeg").content(PNG))
                .andExpect(status().isUnsupportedMediaType());
        byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);
        mvc.perform(put(ADMIN + "/{id}/image", id).with(administrator()).contentType("image/svg+xml").content(svg))
                .andExpect(status().isUnsupportedMediaType());
        byte[] tropLourde = Arrays.copyOf(PNG, AdminProductController.MAX_IMAGE_BYTES + 1);
        mvc.perform(put(ADMIN + "/{id}/image", id).with(administrator()).contentType("image/png")
                        .content(tropLourde))
                .andExpect(status().is(413));
        mvc.perform(get("/api/v1/products/{id}", id)).andExpect(jsonPath("$.imageUrl", nullValue()));
    }

    @Test
    @DisplayName("US21 — Seul l'administrateur modifie les images ; produit inconnu : 404")
    void controleDAcces() throws Exception {
        mvc.perform(put(ADMIN + "/{id}/image", MUG).contentType("image/png").content(PNG))
                .andExpect(status().isUnauthorized());
        mvc.perform(put(ADMIN + "/{id}/image", MUG).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER")))
                        .contentType("image/png").content(PNG))
                .andExpect(status().isForbidden());
        mvc.perform(delete(ADMIN + "/{id}/image", MUG).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
                .andExpect(status().isForbidden());
        mvc.perform(put(ADMIN + "/{id}/image", UUID.randomUUID()).with(administrator()).contentType("image/png")
                        .content(PNG))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/products/{id}", MUG)).andExpect(jsonPath("$.imageUrl", startsWith("/api/v1/")))
                .andExpect(jsonPath("$.sku", is("GOO-MUG-001")));
    }
}
