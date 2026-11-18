package com.petitemaisonepouvante.community.moderation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
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

/** US12 — signalement par les membres, modération par les administrateurs. */
class ModerationApiIT extends AbstractIntegrationTest {

    private static final String API = "/api/v1/community";

    private ResultActions report(RequestPostProcessor who, String type, String id, String reason) throws Exception {
        return mvc.perform(post(API + "/reports").with(who).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("targetType", type, "targetId", id, "reason", reason))));
    }

    /** Signalement ouvert visant le contenu donné, tel que le voit la modération. */
    private JsonNode openReport(RequestPostProcessor moderator, String targetId) throws Exception {
        JsonNode reports = read(mvc.perform(get(API + "/moderation/reports").with(moderator))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        for (JsonNode report : reports) {
            if (report.get("targetId").asString().equals(targetId)) {
                return report;
            }
        }
        throw new AssertionError("Aucun signalement ouvert pour " + targetId);
    }

    @Test
    @DisplayName("Annonce signalée puis masquée : invisible, propositions refusées, auteur prévenu, signalement clos")
    void masquerUneAnnonce() throws Exception {
        String aliceName = unique("alice");
        RequestPostProcessor alice = member(aliceName);
        RequestPostProcessor carol = member(unique("carol"));
        RequestPostProcessor dave = member(unique("dave"));
        String moderateurName = unique("admin");
        RequestPostProcessor moderateur = admin(moderateurName);
        String annonce = publish(alice, "Annonce douteuse");
        String offre = offer(dave, annonce, "Je suis intéressé.");

        report(carol, "LISTING", annonce, "Vente déguisée").andExpect(status().isAccepted());
        report(carol, "LISTING", annonce, "Encore").andExpect(status().isAccepted());
        report(dave, "LISTING", annonce, "Contenu inapproprié").andExpect(status().isAccepted());
        report(alice, "LISTING", annonce, "Moi-même").andExpect(status().is(422));
        mvc.perform(get(API + "/moderation/reports").with(carol)).andExpect(status().isForbidden());

        JsonNode signalement = openReport(moderateur, annonce);
        assertThat(signalement.get("excerpt").asString()).isEqualTo("Annonce douteuse");
        assertThat(signalement.get("targetAuthorName").asString()).isEqualTo(aliceName);
        assertThat(signalement.has("targetAuthorId")).isFalse();
        String id = signalement.get("id").asString();

        mvc.perform(post(API + "/moderation/reports/{id}/hide", id).with(moderateur)).andExpect(status().isNoContent());
        mvc.perform(post(API + "/moderation/reports/{id}/hide", id).with(moderateur)).andExpect(status().isConflict());

        mvc.perform(get(API + "/listings/{id}", annonce)).andExpect(status().isNotFound());
        mvc.perform(get(API + "/listings/{id}", annonce).with(alice)).andExpect(jsonPath("$.status", is("HIDDEN")));
        mvc.perform(get(API + "/offers/{id}", offre).with(dave)).andExpect(jsonPath("$.status", is("DECLINED")));
        mvc.perform(get(API + "/notifications").with(alice))
                .andExpect(jsonPath("$[0].type", is("CONTENT_HIDDEN")))
                .andExpect(jsonPath("$[0].link", is("/mon-espace")));
        mvc.perform(get(API + "/moderation/reports").with(moderateur))
                .andExpect(jsonPath("$[*].targetId", not(hasItem(annonce))));
        mvc.perform(get(API + "/moderation/reports").with(moderateur).param("status", "ACTIONED"))
                .andExpect(jsonPath("$[?(@.targetId == '" + annonce + "')].status", everyItem(is("ACTIONED"))))
                .andExpect(jsonPath("$[?(@.targetId == '" + annonce + "')].handledBy", hasItem(moderateurName)));
    }

    @Test
    @DisplayName("Message de salon signalé puis masqué : il disparaît du salon et son auteur est prévenu")
    void masquerUnMessage() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        RequestPostProcessor moderateur = admin(unique("admin"));
        String message = read(mvc.perform(post(API + "/rooms/general/messages").with(alice)
                        .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("content", "Message à masquer"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).get("id").asString();

        report(member(unique("carol")), "MESSAGE", message, "Propos insultants").andExpect(status().isAccepted());
        String id = openReport(moderateur, message).get("id").asString();
        mvc.perform(post(API + "/moderation/reports/{id}/hide", id).with(moderateur)).andExpect(status().isNoContent());

        mvc.perform(get(API + "/rooms/general/messages").with(alice))
                .andExpect(jsonPath("$[*].id", not(hasItem(Integer.parseInt(message)))));
        mvc.perform(get(API + "/notifications").with(alice)).andExpect(jsonPath("$[0].type", is("CONTENT_HIDDEN")));
        report(member(unique("dave")), "MESSAGE", message, "Déjà masqué").andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Signalement rejeté : le contenu reste visible ; un message privé n'est signalable que par ses participants")
    void rejeterEtConfidentialite() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        RequestPostProcessor carol = member(unique("carol"));
        RequestPostProcessor moderateur = admin(unique("admin"));
        String annonce = publish(alice, "Annonce correcte");
        String offre = offer(carol, annonce, "Proposition privée");

        report(carol, "LISTING", annonce, "Erreur de ma part").andExpect(status().isAccepted());
        String id = openReport(moderateur, annonce).get("id").asString();
        mvc.perform(post(API + "/moderation/reports/{id}/dismiss", id).with(moderateur))
                .andExpect(status().isNoContent());
        mvc.perform(post(API + "/moderation/reports/{id}/dismiss", id).with(moderateur))
                .andExpect(status().isConflict());
        mvc.perform(get(API + "/listings/{id}", annonce)).andExpect(jsonPath("$.status", is("ACTIVE")));
        mvc.perform(post(API + "/moderation/reports/{id}/dismiss", "5c0a0009-0000-4000-8000-000000000009")
                .with(moderateur)).andExpect(status().isNotFound());

        String messagePrive = read(mvc.perform(get(API + "/offers/{id}/messages", offre).with(alice))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8)).get(0).get("id").asString();
        report(member(unique("intrus")), "MESSAGE", messagePrive, "Curiosité").andExpect(status().isNotFound());
        report(alice, "MESSAGE", messagePrive, "Message déplacé").andExpect(status().isAccepted());

        report(carol, "LISTING", "123", "Identifiant invalide").andExpect(status().isNotFound());
        report(carol, "MESSAGE", "abc", "Identifiant invalide").andExpect(status().isNotFound());
        report(carol, "MESSAGE", "zz!", "Identifiant invalide").andExpect(status().isBadRequest());
        report(carol, "LISTING", annonce, "").andExpect(status().isBadRequest());
    }
}
