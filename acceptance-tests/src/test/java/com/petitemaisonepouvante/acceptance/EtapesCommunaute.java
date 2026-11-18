package com.petitemaisonepouvante.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import io.cucumber.java.fr.Alors;
import io.cucumber.java.fr.Et;
import io.cucumber.java.fr.Etantdonné;
import io.cucumber.java.fr.Quand;

/** Définitions des étapes Gherkin de l'espace communautaire (US8 à US12). */
public class EtapesCommunaute {

    private static final String API = "/api/v1/community";

    private final PmeApi api = new PmeApi();
    private String annonce;
    private String proposition;
    private PmeApi.Response reponse;

    private String dernierType(String membre) {
        PmeApi.Response notifications = api.get("communaute", API + "/notifications", membre);
        assertThat(notifications.status()).isEqualTo(200);
        assertThat(notifications.body()).as("notifications de %s", membre).isNotEmpty();
        return notifications.body().get(0).get("type").asString();
    }

    @Etantdonné("{string} publie l'annonce d'échange {string}")
    public void publier(String membre, String titre) {
        String corps = PmeApi.JSON.writeValueAsString(Map.of("type", "EXCHANGE", "title", titre,
                "description", "Annonce publiée par les tests d'acceptation.", "category", "FIGURINES",
                "condition", "GOOD", "wanted", "Un Blu-ray collector"));
        reponse = api.post("communaute", API + "/listings", membre, corps);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(201);
        annonce = reponse.body().get("id").asString();
    }

    @Quand("{string} propose un échange sur cette annonce")
    public void proposer(String membre) {
        reponse = api.post("communaute", API + "/listings/" + annonce + "/offers", membre,
                "{\"message\":\"Je propose une affiche en échange.\"}");
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(201);
        proposition = reponse.body().get("id").asString();
    }

    @Alors("{string} est notifiée d'une nouvelle proposition")
    public void notifieeProposition(String membre) {
        assertThat(dernierType(membre)).isEqualTo("NEW_OFFER");
    }

    @Quand("{string} accepte la proposition")
    public void accepter(String membre) {
        reponse = api.post("communaute", API + "/offers/" + proposition + "/acceptance", membre, "{}");
    }

    @Alors("la proposition est {string} et l'annonce est {string}")
    public void statuts(String statutProposition, String statutAnnonce) {
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        assertThat(reponse.body().get("status").asString()).isEqualTo(statutProposition);
        assertThat(api.get("communaute", API + "/listings/" + annonce, null).body().get("status").asString())
                .isEqualTo(statutAnnonce);
    }

    @Et("{string} est notifiée de l'acceptation")
    public void notifieeAcceptation(String membre) {
        assertThat(dernierType(membre)).isEqualTo("OFFER_ACCEPTED");
    }

    @Alors("{string} ne voit pas la proposition")
    public void propositionInvisible(String membre) {
        assertThat(api.get("communaute", API + "/offers/" + proposition, membre).status()).isEqualTo(404);
    }

    @Et("{string} ne peut pas publier d'annonce")
    public void publicationRefusee(String membre) {
        assertThat(api.post("communaute", API + "/listings", membre, "{}").status()).isEqualTo(403);
    }

    @Quand("{string} écrit {string} dans le salon {string}")
    public void ecrire(String membre, String texte, String salon) {
        reponse = api.post("communaute", API + "/rooms/" + salon + "/messages", membre,
                PmeApi.JSON.writeValueAsString(Map.of("content", texte)));
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(201);
    }

    @Alors("{string} lit {string} dans le salon {string}")
    public void lire(String membre, String texte, String salon) {
        PmeApi.Response messages = api.get("communaute", API + "/rooms/" + salon + "/messages", membre);
        assertThat(messages.status()).isEqualTo(200);
        assertThat(messages.body().get(messages.body().size() - 1).get("content").asString()).isEqualTo(texte);
    }
}
