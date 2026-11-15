# language: fr
Fonctionnalité: US4 — Consulter l'historique de mes commandes
  En tant que client, je veux voir l'historique de mes commandes, et seulement les miennes.

  Scénario: Chaque client ne voit que ses propres commandes
    Étant donné l'utilisateur "carol" est connecté
    Et il a commandé 1 "Fanzine numéro 37"
    Quand l'utilisateur "carol" consulte son historique
    Alors la réponse a le statut 200
    Et l'historique contient cette commande
    Quand l'utilisateur "alice" consulte cette commande
    Alors la réponse a le statut 404
    Quand l'utilisateur "carol" consulte cette commande
    Alors la réponse a le statut 200
