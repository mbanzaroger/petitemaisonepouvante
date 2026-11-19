package com.petitemaisonepouvante.editorial.article;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.editorial.AbstractIntegrationTest;

/** US15 — actualités et articles de fond en accès libre, publication et retrait par la rédaction. */
class ArticleApiIT extends AbstractIntegrationTest {

    private static final String API = "/api/v1/editorial";

    private ResultActions publish(RequestPostProcessor who, String kind, String title) throws Exception {
        return mvc.perform(post(API + "/admin/articles").with(who).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("kind", kind, "title", title, "summary", "Résumé de l'article publié.",
                        "body", "Premier paragraphe.\n\nSecond paragraphe de l'article."))));
    }

    @Test
    @DisplayName("Les actualités et articles de fond sont publics, filtrables par type, les plus récents d'abord")
    void lecturePublique() throws Exception {
        mvc.perform(get(API + "/articles").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].slug", hasItem("la-gamme-evil-ed-arrive-en-exclusivite")))
                .andExpect(jsonPath("$.content[0].body").doesNotExist());
        mvc.perform(get(API + "/articles").param("kind", "FEATURE").param("size", "50"))
                .andExpect(jsonPath("$.content[*].kind", everyItem(is("FEATURE"))));
        mvc.perform(get(API + "/articles/{slug}", "pourquoi-les-couleurs-du-giallo-nous-hantent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind", is("FEATURE")))
                .andExpect(jsonPath("$.body", startsWith("Le giallo")));
        mvc.perform(get(API + "/articles/{slug}", "inconnu")).andExpect(status().isNotFound());
        mvc.perform(get(API + "/articles/{slug}", "PAS VALIDE")).andExpect(status().isBadRequest());
        mvc.perform(get(API + "/articles").param("kind", "BLOG")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("La rédaction publie (adresse lisible, sans doublon) puis retire un article ; les membres sont refusés")
    void publicationEtRetrait() throws Exception {
        String titre = "Nuit blanche : le programme dévoilé " + unique("n");
        String reponse = publish(admin(unique("redaction")), "NEWS", titre)
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith(API + "/articles/nuit-blanche-le-programme-devoile-")))
                .andExpect(jsonPath("$.kind", is("NEWS")))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String id = read(reponse).get("id").asString();
        String slug = read(reponse).get("slug").asString();
        publish(admin(unique("redaction")), "NEWS", titre).andExpect(jsonPath("$.slug", is(slug + "-2")));

        mvc.perform(get(API + "/articles/{slug}", slug)).andExpect(status().isOk());
        mvc.perform(post(API + "/admin/articles/{id}/unpublish", id).with(admin(unique("redaction"))))
                .andExpect(status().isNoContent());
        mvc.perform(get(API + "/articles/{slug}", slug)).andExpect(status().isNotFound());
        mvc.perform(get(API + "/articles").param("size", "50"))
                .andExpect(jsonPath("$.content[*].slug", not(hasItem(slug))));
        mvc.perform(post(API + "/admin/articles/{id}/unpublish", id).with(admin(unique("redaction"))))
                .andExpect(status().isNotFound());

        publish(member(unique("alice")), "NEWS", "Tentative de publication").andExpect(status().isForbidden());
        mvc.perform(post(API + "/admin/articles").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        publish(admin(unique("redaction")), "NEWS", "abc").andExpect(status().isBadRequest());
    }
}
