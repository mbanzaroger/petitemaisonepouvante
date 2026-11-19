package com.petitemaisonepouvante.editorial.fanzine;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.editorial.AbstractIntegrationTest;

/** US16 — fanzine numérique : sommaire public, extrait gratuit, achat, liseuse, bibliothèque et progression. */
class FanzineApiIT extends AbstractIntegrationTest {

    private static final String API = "/api/v1/editorial";

    private ResultActions progress(RequestPostProcessor who, int number, int page) throws Exception {
        return mvc.perform(put(API + "/library/{number}/progress", number).with(who)
                .contentType(MediaType.APPLICATION_JSON).content("{\"page\":" + page + "}"));
    }

    @Test
    @DisplayName("Le sommaire est public ; la première page est un extrait lisible par tous")
    void sommaireEtExtrait() throws Exception {
        mvc.perform(get(API + "/issues"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].number", is(37)))
                .andExpect(jsonPath("$[0].pageCount", is(4)))
                .andExpect(jsonPath("$[0].priceCents", is(390)))
                .andExpect(jsonPath("$[*].access", everyItem(is("PREVIEW"))));
        mvc.perform(get(API + "/issues/{n}", 37))
                .andExpect(jsonPath("$.contents", hasSize(4)))
                .andExpect(jsonPath("$.contents[3]", is("Lexique du fan")));
        mvc.perform(get(API + "/issues/{n}/pages/{p}", 37, 1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Édito")))
                .andExpect(jsonPath("$.access", is("PREVIEW")));
        mvc.perform(get(API + "/issues/{n}/pages/{p}", 37, 2))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.detail", is("Connectez-vous pour lire la suite de ce numéro.")));
        mvc.perform(get(API + "/issues/{n}", 99)).andExpect(status().isNotFound());
        mvc.perform(get(API + "/issues/{n}/pages/{p}", 37, 9)).andExpect(status().isNotFound());
        mvc.perform(get(API + "/issues/{n}/pages/{p}", 37, 0)).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Après achat, le numéro est lisible en entier, rangé dans la bibliothèque, avec la page atteinte")
    void achatEtLecture() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        mvc.perform(get(API + "/issues/{n}/pages/{p}", 36, 2).with(alice))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.detail", is("Achetez ce numéro ou abonnez-vous pour lire la suite.")));
        progress(alice, 36, 2).andExpect(status().isForbidden());

        mvc.perform(post(API + "/issues/{n}/purchase", 36).with(alice))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.access", is("PURCHASE")));
        mvc.perform(post(API + "/issues/{n}/purchase", 36).with(alice))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", is("Ce numéro est déjà dans votre bibliothèque.")));
        mvc.perform(post(API + "/issues/{n}/purchase", 99).with(alice)).andExpect(status().isNotFound());

        mvc.perform(get(API + "/issues/{n}/pages/{p}", 36, 3).with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Atelier : vieillir une figurine")))
                .andExpect(jsonPath("$.access", is("PURCHASE")))
                .andExpect(jsonPath("$.pageCount", is(4)));
        mvc.perform(get(API + "/issues").with(alice))
                .andExpect(jsonPath("$[?(@.number == 36)].access", everyItem(is("PURCHASE"))));

        mvc.perform(get(API + "/library").with(alice))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].issue.number", is(36)))
                .andExpect(jsonPath("$[0].lastPage", is(1)))
                .andExpect(jsonPath("$[0].purchasedAt").isString());
        progress(alice, 36, 3).andExpect(status().isNoContent());
        progress(alice, 36, 4).andExpect(status().isNoContent());
        mvc.perform(get(API + "/library").with(alice)).andExpect(jsonPath("$[0].lastPage", is(4)));
        progress(alice, 36, 7).andExpect(status().is(422));
        progress(alice, 36, 0).andExpect(status().isBadRequest());

        mvc.perform(get(API + "/library")).andExpect(status().isUnauthorized());
        mvc.perform(post(API + "/issues/{n}/purchase", 36).with(withoutRole(unique("bob"))))
                .andExpect(status().isForbidden());
    }
}
