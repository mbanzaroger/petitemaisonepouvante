package com.petitemaisonepouvante.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import io.cucumber.java.fr.Alors;
import io.cucumber.java.fr.Et;
import io.cucumber.java.fr.Etantdonné;
import io.cucumber.java.fr.Quand;
import tools.jackson.databind.JsonNode;

/** Définitions des étapes Gherkin des éditions : actualités, fanzine numérique et abonnement (US15 à US17). */
public class EtapesEditions {

    private static final String API = "/api/v1/editorial";

    private final PmeApi api = new PmeApi();
    private String slug;

    private PmeApi.Response page(int numero, int page, String membre) {
        return api.get("editions", API + "/issues/" + numero + "/pages/" + page, membre);
    }

    private boolean dansBibliotheque(String membre, int numero) {
        PmeApi.Response bibliotheque = api.get("editions", API + "/library", membre);
        assertThat(bibliotheque.status()).as(bibliotheque.raw().body()).isEqualTo(200);
        JsonNode numeros = bibliotheque.body();
        for (int i = 0; i < numeros.size(); i++) {
            if (numeros.get(i).get("issue").get("number").asInt() == numero) {
                return true;
            }
        }
        return false;
    }

    @Alors("un visiteur lit la page 1 du numéro {int} en extrait")
    public void extrait(int numero) {
        PmeApi.Response reponse = page(numero, 1, null);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        assertThat(reponse.body().get("access").asString()).isEqualTo("PREVIEW");
        assertThat(reponse.body().get("content").asString()).isNotBlank();
    }

    @Et("un visiteur est invité à se connecter pour lire la page {int} du numéro {int}")
    public void suiteReservee(int page, int numero) {
        assertThat(page(numero, page, null).status()).isEqualTo(401);
    }

    @Quand("{string} achète le numéro {int}")
    public void acheter(String membre, int numero) {
        // Environnement partagé : un numéro déjà acheté lors d'une exécution précédente reste acquis.
        if (!dansBibliotheque(membre, numero)) {
            PmeApi.Response reponse = api.post("editions", API + "/issues/" + numero + "/purchase", membre, "{}");
            assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(201);
        }
    }

    @Alors("{string} lit la page {int} du numéro {int} avec l'accès {string}")
    public void lire(String membre, int page, int numero, String acces) {
        PmeApi.Response reponse = page(numero, page, membre);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        assertThat(reponse.body().get("access").asString()).isEqualTo(acces);
    }

    @Et("le numéro {int} est dans la bibliothèque de {string}")
    public void bibliotheque(int numero, String membre) {
        assertThat(dansBibliotheque(membre, numero)).isTrue();
    }

    @Et("un second achat du numéro {int} par {string} est refusé")
    public void secondAchat(int numero, String membre) {
        assertThat(api.post("editions", API + "/issues/" + numero + "/purchase", membre, "{}").status())
                .isEqualTo(409);
    }

    @Et("{string} ne peut pas acheter de numéro")
    public void achatRefuse(String membre) {
        assertThat(api.post("editions", API + "/issues/35/purchase", membre, "{}").status()).isEqualTo(403);
    }

    @Etantdonné("{string} a un abonnement numérique en cours")
    public void abonnement(String membre) {
        PmeApi.Response actuel = api.get("editions", API + "/subscription", membre);
        assertThat(actuel.status()).as(actuel.raw().body()).isEqualTo(200);
        if (!actuel.body().get("active").asBoolean()) {
            PmeApi.Response reponse = api.post("editions", API + "/subscription", membre, "{\"plan\":\"DIGITAL\"}");
            assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(201);
        }
    }

    @Et("le renouvellement de {string} est refusé tant que l'échéance est à plus de 60 jours")
    public void renouvellementPrecoce(String membre) {
        PmeApi.Response actuel = api.get("editions", API + "/subscription", membre);
        assertThat(actuel.body().get("renewable").asBoolean()).isFalse();
        assertThat(api.post("editions", API + "/subscription/renewal", membre, "{\"plan\":\"DIGITAL\"}").status())
                .isEqualTo(409);
    }

    @Quand("{string} publie l'actualité {string}")
    public void publier(String membre, String titre) {
        String corps = PmeApi.JSON.writeValueAsString(Map.of("kind", "NEWS", "title", titre + " " + System.nanoTime(),
                "summary", "Actualité publiée par les tests d'acceptation.",
                "body", "Premier paragraphe de l'actualité.\n\nSecond paragraphe de l'actualité."));
        PmeApi.Response reponse = api.post("editions", API + "/admin/articles", membre, corps);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(201);
        slug = reponse.body().get("slug").asString();
    }

    @Alors("un visiteur lit cette actualité")
    public void lireActualite() {
        PmeApi.Response reponse = api.get("editions", API + "/articles/" + slug, null);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        assertThat(reponse.body().get("body").asString()).contains("Second paragraphe");
    }

    @Et("{string} ne peut pas publier d'actualité")
    public void publicationRefusee(String membre) {
        assertThat(api.post("editions", API + "/admin/articles", membre, "{}").status()).isEqualTo(403);
    }
}
