# language: fr
Fonctionnalité: US18 et US19 — Administrer la boutique : produits, stock et commandes des clients
  En tant qu'administrateur, je veux mettre en vente un nouveau produit, l'approvisionner et suivre les commandes de
  tous les clients ; un client ne doit pouvoir faire aucune de ces opérations.

  Scénario: Un produit créé et approvisionné par l'administrateur est commandé, et la commande est suivie
    Quand "admin-pme" crée le produit "Figurine de recette" à 2490 centimes dans la catégorie "Figurines"
    Et "admin-pme" ajoute 3 unités au stock de ce produit
    Alors ce produit est proposé dans le catalogue public
    Quand "carol" commande 1 exemplaire de ce produit
    Alors cette commande est confirmée
    Et "admin-pme" voit cette commande de "carol" parmi les commandes confirmées
    Et il reste 2 unités de ce produit en stock
    Quand "admin-pme" retire ce produit de la vente
    Alors ce produit n'est plus proposé dans le catalogue public

  Scénario: Un client ne peut ni gérer les produits ni suivre les commandes des autres
    Alors "alice" ne peut pas créer de produit
    Et "alice" ne peut pas réapprovisionner un produit
    Et "alice" ne peut pas consulter les commandes des clients
