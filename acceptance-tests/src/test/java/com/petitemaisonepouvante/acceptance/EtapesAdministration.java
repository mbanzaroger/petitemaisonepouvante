package com.petitemaisonepouvante.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import io.cucumber.java.fr.Alors;
import io.cucumber.java.fr.Et;
import io.cucumber.java.fr.Quand;
import tools.jackson.databind.JsonNode;

/** Définitions des étapes Gherkin de l'administration de la boutique (US18, US19), à travers le Gateway. */
public class EtapesAdministration {

    private static final String PRODUITS = "/api/v1/catalog/admin/products";

    private final PmeApi api = new PmeApi();
    private String produit;
    private String sku;
    private String nom;
    private int prix;
    private String categorie;
    private String commande;
    private String client;

    private String creation(String reference) {
        return PmeApi.JSON.writeValueAsString(Map.of("sku", reference, "name", nom, "description",
                "Produit créé par les tests d'acceptation.", "priceCents", prix, "category", categorie,
                "exclusive", false));
    }

    private List<String> referencesEnVente() {
        PmeApi.Response reponse = api.get("catalogue", "/api/v1/products?size=100&category=" + categorie, null);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        List<String> references = new ArrayList<>();
        JsonNode contenu = reponse.body().get("content");
        for (int i = 0; i < contenu.size(); i++) {
            references.add(contenu.get(i).get("sku").asString());
        }
        return references;
    }

    @Quand("{string} crée le produit {string} à {int} centimes dans la catégorie {string}")
    public void creer(String administrateur, String libelle, int centimes, String categorie) {
        this.nom = libelle;
        this.prix = centimes;
        this.categorie = categorie;
        this.sku = "ACC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        PmeApi.Response reponse = api.post("catalogue", PRODUITS, administrateur, creation(sku));
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(201);
        produit = reponse.body().get("id").asString();
    }

    @Et("{string} ajoute {int} unités au stock de ce produit")
    public void reapprovisionner(String administrateur, int quantite) {
        PmeApi.Response reponse = api.post("stock", "/api/v1/stock/" + produit + "/restock", administrateur,
                "{\"quantity\":" + quantite + "}");
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        assertThat(reponse.body().get("available").asInt()).isEqualTo(quantite);
    }

    @Alors("ce produit est proposé dans le catalogue public")
    public void enVente() {
        assertThat(referencesEnVente()).contains(sku);
    }

    @Quand("{string} commande {int} exemplaire de ce produit")
    public void commander(String membre, int quantite) {
        client = membre;
        PmeApi.Response reponse = api.post("commandes", "/api/v1/orders", membre,
                "{\"lines\":[{\"productId\":\"" + produit + "\",\"quantity\":" + quantite + "}]}");
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(202);
        commande = reponse.body().get("id").asString();
    }

    @Alors("cette commande est confirmée")
    public void confirmee() throws InterruptedException {
        String statut = null;
        for (int i = 0; i < 30 && !"CONFIRMED".equals(statut); i++) {
            Thread.sleep(1000);
            statut = api.get("commandes", "/api/v1/orders/" + commande, client).body().get("status").asString();
        }
        assertThat(statut).isEqualTo("CONFIRMED");
    }

    @Et("{string} voit cette commande de {string} parmi les commandes confirmées")
    public void suivie(String administrateur, String membre) {
        PmeApi.Response reponse = api.get("commandes", "/api/v1/orders/admin?status=CONFIRMED&size=100",
                administrateur);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        JsonNode contenu = reponse.body().get("content");
        String trouve = null;
        for (int i = 0; i < contenu.size(); i++) {
            if (commande.equals(contenu.get(i).get("id").asString())) {
                trouve = contenu.get(i).get("customerName").asString();
            }
        }
        assertThat(trouve).isEqualTo(membre);
    }

    @Et("il reste {int} unités de ce produit en stock")
    public void stockRestant(int attendu) {
        PmeApi.Response reponse = api.get("stock", "/api/v1/stock/" + produit, "admin-pme");
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        assertThat(reponse.body().get("available").asInt()).isEqualTo(attendu);
    }

    @Quand("{string} retire ce produit de la vente")
    public void retirer(String administrateur) {
        String corps = PmeApi.JSON.writeValueAsString(Map.of("name", nom, "description", "", "priceCents", prix,
                "category", categorie, "exclusive", false, "active", false));
        PmeApi.Response reponse = api.put("catalogue", PRODUITS + "/" + produit, administrateur, corps);
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(200);
        assertThat(reponse.body().get("available").asBoolean()).isFalse();
    }

    @Alors("ce produit n'est plus proposé dans le catalogue public")
    public void retire() {
        assertThat(referencesEnVente()).doesNotContain(sku);
    }

    @Alors("{string} ne peut pas créer de produit")
    public void creationRefusee(String membre) {
        nom = "Produit interdit";
        prix = 990;
        categorie = "Goodies";
        assertThat(api.post("catalogue", PRODUITS, membre, creation("ACC-INTERDIT")).status()).isEqualTo(403);
    }

    @Et("{string} ne peut pas réapprovisionner un produit")
    public void reapprovisionnementRefuse(String membre) {
        assertThat(api.post("stock", "/api/v1/stock/" + UUID.randomUUID() + "/restock", membre, "{\"quantity\":1}")
                .status()).isEqualTo(403);
    }

    @Et("{string} ne peut pas consulter les commandes des clients")
    public void suiviRefuse(String membre) {
        assertThat(api.get("commandes", "/api/v1/orders/admin", membre).status()).isEqualTo(403);
    }
}
