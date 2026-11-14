package com.petitemaisonepouvante.acceptance;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import io.cucumber.java.fr.Alors;
import io.cucumber.java.fr.Et;
import io.cucumber.java.fr.Etantdonné;
import io.cucumber.java.fr.Quand;

/** Définitions des étapes Gherkin (en français) des user stories US1 à US4. */
public class EtapesBoutique {

    /** Produits de démonstration (identifiants fixes partagés par catalog-service et stock-service). */
    private static final Map<String, String> PRODUITS = Map.of(
            "Figurine L'Orc", "0f6c1a10-0001-4000-8000-000000000001",
            "Buste de L'Orc", "0f6c1a10-0002-4000-8000-000000000002",
            "Mug", "0f6c1a10-0008-4000-8000-000000000008",
            "Fanzine numéro 37", "0f6c1a10-0011-4000-8000-000000000011");

    private final PmeApi api = new PmeApi();
    private PmeApi.Response reponse;
    private String utilisateur;
    private String commande;
    private int stockAvant;

    private static String id(String produit) {
        String id = PRODUITS.get(produit);
        assertThat(id).as("produit de démonstration « %s »", produit).isNotNull();
        return id;
    }

    private int stockDisponible(String produit) {
        PmeApi.Response stock = api.get("stock", "/api/v1/stock/" + id(produit), "admin-pme");
        assertThat(stock.status()).isEqualTo(200);
        return stock.body().get("available").asInt();
    }

    @Quand("un visiteur consulte la page {int} du catalogue avec {int} produits par page")
    public void consulterCatalogue(int page, int taille) {
        reponse = api.get("catalogue", "/api/v1/products?page=" + page + "&size=" + taille, null);
    }

    @Quand("un visiteur consulte le produit {string}")
    public void consulterProduit(String id) {
        reponse = api.get("catalogue", "/api/v1/products/" + id, null);
    }

    @Alors("la réponse a le statut {int}")
    public void statut(int attendu) {
        assertThat(reponse.status()).as(reponse.raw().body()).isEqualTo(attendu);
    }

    @Et("la page contient {int} produits avec un prix et une disponibilité")
    public void contenuPage(int nombre) {
        assertThat(reponse.body().get("content")).hasSize(nombre);
        reponse.body().get("content").forEach(produit -> {
            assertThat(produit.get("price").get("amountCents").asInt()).isPositive();
            assertThat(produit.get("price").get("currency").asString()).isEqualTo("EUR");
            assertThat(produit.get("available").asBoolean()).isTrue();
        });
    }

    @Et("le catalogue compte {int} produits en vente")
    public void totalCatalogue(int total) {
        assertThat(reponse.body().get("totalElements").asInt()).isEqualTo(total);
    }

    @Etantdonné("l'utilisateur {string} est connecté")
    public void connecte(String nom) {
        utilisateur = nom;
        api.token(nom);
    }

    @Etantdonné("le stock disponible de {string} est relevé")
    public void releverStock(String produit) {
        stockAvant = stockDisponible(produit);
    }

    @Quand("un visiteur anonyme commande {int} {string}")
    public void commandeAnonyme(int quantite, String produit) {
        reponse = api.post("commandes", "/api/v1/orders", null, ligne(produit, quantite));
    }

    @Quand("il commande {int} {string}")
    @Et("il a commandé {int} {string}")
    public void commander(int quantite, String produit) {
        reponse = api.post("commandes", "/api/v1/orders", utilisateur, ligne(produit, quantite));
        if (reponse.status() == 202) {
            commande = reponse.body().get("id").asString();
            assertThat(reponse.body().get("status").asString()).isEqualTo("PENDING");
        }
    }

    @Alors("la commande passe à l'état {string}")
    public void etatFinal(String etat) throws InterruptedException {
        String obtenu = null;
        for (int i = 0; i < 30 && !etat.equals(obtenu); i++) {
            Thread.sleep(1000);
            obtenu = api.get("commandes", "/api/v1/orders/" + commande, utilisateur).body().get("status").asString();
        }
        assertThat(obtenu).isEqualTo(etat);
    }

    @Et("le stock disponible de {string} a diminué de {int}")
    public void stockDiminue(String produit, int quantite) {
        assertThat(stockDisponible(produit)).isEqualTo(stockAvant - quantite);
    }

    @Et("le stock disponible de {string} est inchangé")
    public void stockInchange(String produit) {
        assertThat(stockDisponible(produit)).isEqualTo(stockAvant);
    }

    @Quand("l'utilisateur {string} consulte cette commande")
    public void consulterCommande(String nom) {
        reponse = api.get("commandes", "/api/v1/orders/" + commande, nom);
    }

    @Quand("l'utilisateur {string} consulte son historique")
    public void historique(String nom) {
        reponse = api.get("commandes", "/api/v1/orders", nom);
    }

    @Et("l'historique contient cette commande")
    public void historiqueContient() {
        boolean present = false;
        for (var c : reponse.body().get("content")) {
            present |= commande.equals(c.get("id").asString());
        }
        assertThat(present).isTrue();
    }

    private static String ligne(String produit, int quantite) {
        return "{\"lines\":[{\"productId\":\"" + id(produit) + "\",\"quantity\":" + quantite + "}]}";
    }
}
