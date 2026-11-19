package com.petitemaisonepouvante.community.listing;

import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.community.AbstractIntegrationTest;

/** US8 — annonces de troc et de dons : lecture publique, publication, recherche et retrait. */
class ListingApiIT extends AbstractIntegrationTest {

    private static final String LISTINGS = "/api/v1/community/listings";

    private Map<String, Object> listing(String type, String title) {
        Map<String, Object> listing = new HashMap<>();
        listing.put("type", type);
        listing.put("title", title);
        listing.put("description", "Description suffisamment détaillée de l'objet proposé.");
        listing.put("category", "BLURAY");
        listing.put("condition", "GOOD");
        listing.put("wanted", "Une affiche de film");
        return listing;
    }

    @Test
    @DisplayName("Un visiteur consulte les annonces en cours sans être connecté (données de démonstration)")
    void lecturePublique() throws Exception {
        mvc.perform(get(LISTINGS).param("type", "GIFT").param("size", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[*].title", hasItem("Lot de magazines de cinéma fantastique")))
                .andExpect(jsonPath("$.content[*].type", everyItem(is("GIFT"))))
                .andExpect(jsonPath("$.content[*].mine", everyItem(is(false))))
                .andExpect(jsonPath("$.content[0].ownerName").isString());
    }

    @Test
    @DisplayName("Un membre publie une annonce d'échange, la retrouve dans ses annonces et par la recherche")
    void publication() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        String mot = unique("Zombi");
        mvc.perform(post(LISTINGS).with(alice).contentType(MediaType.APPLICATION_JSON)
                        .content(body(listing("EXCHANGE", "Blu-ray " + mot + " édition collector"))))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", startsWith(LISTINGS + "/")))
                .andExpect(jsonPath("$.status", is("ACTIVE")))
                .andExpect(jsonPath("$.mine", is(true)))
                .andExpect(jsonPath("$.wanted", is("Une affiche de film")));

        mvc.perform(get(LISTINGS).param("q", mot.toLowerCase()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(1)))
                .andExpect(jsonPath("$.content[0].mine", is(false)))
                .andExpect(jsonPath("$.content[0].condition", is("GOOD")));
        mvc.perform(get(LISTINGS).with(alice).param("q", mot).param("category", "BLURAY"))
                .andExpect(jsonPath("$.content[0].mine", is(true)));
        mvc.perform(get(LISTINGS).param("q", mot).param("category", "POSTERS"))
                .andExpect(jsonPath("$.totalElements", is(0)));
        mvc.perform(get(LISTINGS + "/mine").with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title", is("Blu-ray " + mot + " édition collector")));
    }

    @Test
    @DisplayName("Un don n'a pas de contrepartie ; les caractères spéciaux de la recherche sont neutralisés")
    void donEtRecherche() throws Exception {
        String id = read(mvc.perform(post(LISTINGS).with(member(unique("hugo"))).contentType(MediaType.APPLICATION_JSON)
                        .content(body(listing("GIFT", "Coffret offert " + unique("x")))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.wanted", nullValue()))
                .andReturn().getResponse().getContentAsString()).get("id").asString();
        mvc.perform(get(LISTINGS + "/{id}", id)).andExpect(status().isOk()).andExpect(jsonPath("$.type", is("GIFT")));
        mvc.perform(get(LISTINGS).param("q", "%_%")).andExpect(jsonPath("$.totalElements", is(0)));
    }

    @Test
    @DisplayName("Publication refusée : anonyme (401), compte sans profil (403), données invalides (400)")
    void refus() throws Exception {
        String valide = body(listing("EXCHANGE", "Titre valide"));
        mvc.perform(post(LISTINGS).contentType(MediaType.APPLICATION_JSON).content(valide))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(LISTINGS).with(withoutRole(unique("bob"))).contentType(MediaType.APPLICATION_JSON).content(valide))
                .andExpect(status().isForbidden());
        Map<String, Object> sansTitre = listing("EXCHANGE", "");
        mvc.perform(post(LISTINGS).with(member(unique("alice"))).contentType(MediaType.APPLICATION_JSON)
                        .content(body(sansTitre)))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        Map<String, Object> typeInconnu = listing("VENTE", "Titre valide");
        mvc.perform(post(LISTINGS).with(member(unique("alice"))).contentType(MediaType.APPLICATION_JSON)
                        .content(body(typeInconnu)))
                .andExpect(status().isBadRequest());
        mvc.perform(get(LISTINGS).param("size", "500")).andExpect(status().isBadRequest());
        mvc.perform(get(LISTINGS).param("type", "VENTE")).andExpect(status().isBadRequest());
        mvc.perform(get(LISTINGS + "/mine")).andExpect(status().isUnauthorized());
        mvc.perform(get(LISTINGS + "/{id}", "5c0a0009-0000-4000-8000-000000000009"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail", is("Annonce introuvable")));
    }

    @Test
    @DisplayName("Le retrait par l'auteur masque l'annonce, refuse les propositions en attente et prévient leurs auteurs")
    void retrait() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        RequestPostProcessor carol = member(unique("carol"));
        String id = publish(alice, "Figurine à retirer");
        offer(carol, id, "Je vous propose une affiche en échange.");

        mvc.perform(post(LISTINGS + "/{id}/withdrawal", id).with(carol)).andExpect(status().isNotFound());
        mvc.perform(post(LISTINGS + "/{id}/withdrawal", id).with(alice)).andExpect(status().isNoContent());
        mvc.perform(post(LISTINGS + "/{id}/withdrawal", id).with(alice)).andExpect(status().isConflict());

        mvc.perform(get(LISTINGS + "/{id}", id)).andExpect(status().isNotFound());
        mvc.perform(get(LISTINGS + "/{id}", id).with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("WITHDRAWN")));
        mvc.perform(get(LISTINGS + "/{id}", id).with(admin(unique("moderateur")))).andExpect(status().isOk());
        mvc.perform(get(LISTINGS).param("size", "50"))
                .andExpect(jsonPath("$.content[*].id", not(hasItem(id))));
        mvc.perform(get("/api/v1/community/offers").with(carol))
                .andExpect(jsonPath("$.sent[0].status", is("DECLINED")));
        mvc.perform(get("/api/v1/community/notifications").with(carol))
                .andExpect(jsonPath("$[0].type", is("OFFER_DECLINED")))
                .andExpect(jsonPath("$[0].text", is("L'annonce « Figurine à retirer » a été retirée par son auteur.")));
    }
}
