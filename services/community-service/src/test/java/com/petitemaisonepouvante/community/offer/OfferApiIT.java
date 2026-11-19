package com.petitemaisonepouvante.community.offer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.community.AbstractIntegrationTest;

import tools.jackson.databind.JsonNode;

/** US9 — propositions d'échange, acceptation, refus, annulation et conversation privée entre les deux membres. */
class OfferApiIT extends AbstractIntegrationTest {

    private static final String API = "/api/v1/community";

    private ResultActions message(RequestPostProcessor who, String offerId, String content) throws Exception {
        return mvc.perform(post(API + "/offers/{id}/messages", offerId).with(who)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("content", content))));
    }

    private ResultActions makeOffer(RequestPostProcessor who, String listingId) throws Exception {
        return mvc.perform(post(API + "/listings/{id}/offers", listingId).with(who)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("message", "Intéressé !"))));
    }

    @Test
    @DisplayName("Proposition acceptée : annonce conclue, autres propositions refusées, membres prévenus, conversation")
    void parcoursComplet() throws Exception {
        String aliceName = unique("alice");
        RequestPostProcessor alice = member(aliceName);
        RequestPostProcessor carol = member(unique("carol"));
        RequestPostProcessor dave = member(unique("dave"));
        String listing = publish(alice, "Buste peint à échanger");

        String offre = offer(carol, listing, "Je propose mon affiche de « Suspiria ».");
        String autre = offer(dave, listing, "Je propose un jeu de cartes.");
        assertThat(unread(alice)).isEqualTo(2);
        assertThat(notifications(alice).get(0).get("type").asString()).isEqualTo("NEW_OFFER");

        makeOffer(carol, listing).andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", is("Vous avez déjà une proposition en attente sur cette annonce.")));
        makeOffer(alice, listing).andExpect(status().is(422));

        mvc.perform(get(API + "/offers/{id}", offre).with(member(unique("intrus")))).andExpect(status().isNotFound());
        mvc.perform(post(API + "/offers/{id}/acceptance", offre).with(carol)).andExpect(status().isForbidden());

        mvc.perform(post(API + "/offers/{id}/acceptance", offre).with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ACCEPTED")))
                .andExpect(jsonPath("$.listingStatus", is("CONCLUDED")))
                .andExpect(jsonPath("$.sent", is(false)));
        mvc.perform(post(API + "/offers/{id}/acceptance", offre).with(alice)).andExpect(status().isConflict());
        mvc.perform(get(API + "/offers/{id}", autre).with(dave)).andExpect(jsonPath("$.status", is("DECLINED")));
        mvc.perform(get(API + "/listings/{id}", listing)).andExpect(jsonPath("$.status", is("CONCLUDED")));
        makeOffer(member(unique("eve")), listing).andExpect(status().isConflict());

        JsonNode notificationCarol = notifications(carol).get(0);
        assertThat(notificationCarol.get("type").asString()).isEqualTo("OFFER_ACCEPTED");
        assertThat(notificationCarol.get("link").asString()).isEqualTo("/communaute/propositions/" + offre);
        assertThat(notifications(dave).get(0).get("type").asString()).isEqualTo("OFFER_DECLINED");

        // Conversation privée : le message de la proposition ouvre le fil ; l'autre membre est prévenu une seule fois.
        mvc.perform(post(API + "/notifications/read").with(alice)).andExpect(status().isNoContent());
        message(carol, offre, "Je peux passer samedi.").andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine", is(true)));
        message(carol, offre, "Ou dimanche matin.").andExpect(status().isCreated());
        assertThat(unread(alice)).isEqualTo(1);
        String fil = mvc.perform(get(API + "/offers/{id}/messages", offre).with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].content", is("Je propose mon affiche de « Suspiria ».")))
                .andExpect(jsonPath("$[2].mine", is(false)))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        long dernier = read(fil).get(2).get("id").asLong();
        mvc.perform(get(API + "/offers/{id}/messages", offre).with(carol).param("after", Long.toString(dernier)))
                .andExpect(jsonPath("$", hasSize(0)));
        message(alice, offre, "Samedi me va très bien.").andExpect(status().isCreated());
        message(member(unique("intrus")), offre, "Bonjour").andExpect(status().isNotFound());

        mvc.perform(get(API + "/offers").with(alice))
                .andExpect(jsonPath("$.received[0].id", is(offre)))
                .andExpect(jsonPath("$.received[0].authorName").isString())
                .andExpect(jsonPath("$.sent", hasSize(0)));
        mvc.perform(get(API + "/offers").with(carol))
                .andExpect(jsonPath("$.sent[0].ownerName", is(aliceName)))
                .andExpect(jsonPath("$.received", hasSize(0)));
    }

    @Test
    @DisplayName("Refus par l'auteur de l'annonce : la conversation est close et le refus n'est possible qu'une fois")
    void refus() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        RequestPostProcessor carol = member(unique("carol"));
        String offre = offer(carol, publish(alice, "Mug à échanger"), "Échange contre un poster ?");

        mvc.perform(post(API + "/offers/{id}/decline", offre).with(carol)).andExpect(status().isForbidden());
        mvc.perform(post(API + "/offers/{id}/decline", offre).with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("DECLINED")));
        mvc.perform(post(API + "/offers/{id}/decline", offre).with(alice)).andExpect(status().isConflict());
        message(carol, offre, "Dommage !").andExpect(status().isConflict());
        assertThat(notifications(carol).get(0).get("type").asString()).isEqualTo("OFFER_DECLINED");
    }

    @Test
    @DisplayName("Annulation par l'auteur de la proposition ; l'auteur de l'annonce est prévenu")
    void annulation() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        RequestPostProcessor carol = member(unique("carol"));
        String listing = publish(alice, "Jeu de plateau à échanger");
        String offre = offer(carol, listing, "Je propose une figurine.");

        mvc.perform(post(API + "/offers/{id}/cancellation", offre).with(alice)).andExpect(status().isForbidden());
        mvc.perform(post(API + "/offers/{id}/cancellation", offre).with(carol))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CANCELLED")))
                .andExpect(jsonPath("$.sent", is(true)));
        assertThat(notifications(alice).get(0).get("type").asString()).isEqualTo("OFFER_CANCELLED");
        // Après annulation, une nouvelle proposition est de nouveau possible.
        offer(carol, listing, "Finalement, je propose un poster.");
    }

    @Test
    @DisplayName("Proposition sur une annonce inconnue (404) ou avec un message invalide (400)")
    void erreurs() throws Exception {
        RequestPostProcessor carol = member(unique("carol"));
        makeOffer(carol, "5c0a0009-0000-4000-8000-000000000009").andExpect(status().isNotFound());
        mvc.perform(post(API + "/listings/{id}/offers", "5c0a0001-0000-4000-8000-000000000001").with(carol)
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("message", " "))))
                .andExpect(status().isBadRequest());
        mvc.perform(get(API + "/offers")).andExpect(status().isUnauthorized());
        mvc.perform(get(API + "/offers/{id}", "pas-un-uuid").with(carol)).andExpect(status().isBadRequest());
    }
}
