# language: fr
Fonctionnalité: US2 et US3 — Commander un produit dérivé avec réservation de stock
  En tant que client authentifié, je veux commander des articles afin de les recevoir.

  Scénario: Une commande sans jeton est refusée
    Quand un visiteur anonyme commande 1 "Mug"
    Alors la réponse a le statut 401

  Scénario: Une commande sans le rôle CUSTOMER est refusée
    Étant donné l'utilisateur "bob" est connecté
    Quand il commande 1 "Mug"
    Alors la réponse a le statut 403

  Scénario: Stock suffisant, la commande est confirmée et le stock diminue
    Étant donné l'utilisateur "alice" est connecté
    Et le stock disponible de "Mug" est relevé
    Quand il commande 2 "Mug"
    Alors la réponse a le statut 202
    Et la commande passe à l'état "CONFIRMED"
    Et le stock disponible de "Mug" a diminué de 2

  Scénario: Stock insuffisant, la commande est annulée et le stock est inchangé
    Étant donné l'utilisateur "alice" est connecté
    Et le stock disponible de "Buste de L'Orc" est relevé
    Quand il commande 3 "Buste de L'Orc"
    Alors la réponse a le statut 202
    Et la commande passe à l'état "CANCELLED"
    Et le stock disponible de "Buste de L'Orc" est inchangé
