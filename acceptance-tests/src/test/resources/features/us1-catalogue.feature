# language: fr
Fonctionnalité: US1 — Lister et consulter les produits
  En tant que visiteur, je veux lister et consulter des produits afin de choisir.

  Scénario: Un visiteur liste le catalogue paginé
    Quand un visiteur consulte la page 0 du catalogue avec 5 produits par page
    Alors la réponse a le statut 200
    Et la page contient 5 produits avec un prix et une disponibilité
    Et le catalogue compte 11 produits en vente

  Scénario: Un produit inconnu n'existe pas
    Quand un visiteur consulte le produit "7d1e1f00-0000-4000-8000-000000000999"
    Alors la réponse a le statut 404
