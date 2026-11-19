# language: fr
Fonctionnalité: US15 à US17 — Actualités, fanzine numérique et abonnement
  En tant que lecteur, je veux lire les actualités, acheter ou recevoir par abonnement les numéros du fanzine
  et les lire dans une liseuse, sans que la suite d'un numéro soit accessible à qui n'y a pas droit.

  Scénario: Un visiteur lit l'extrait d'un numéro mais pas la suite
    Alors un visiteur lit la page 1 du numéro 35 en extrait
    Et un visiteur est invité à se connecter pour lire la page 2 du numéro 35

  Scénario: Un membre achète un numéro, le lit et le retrouve dans sa bibliothèque
    Quand "carol" achète le numéro 35
    Alors "carol" lit la page 2 du numéro 35 avec l'accès "PURCHASE"
    Et le numéro 35 est dans la bibliothèque de "carol"
    Et un second achat du numéro 35 par "carol" est refusé
    Et "bob" ne peut pas acheter de numéro

  Scénario: Un abonné lit tous les numéros et ne renouvelle qu'à l'approche de l'échéance
    Étant donné "alice" a un abonnement numérique en cours
    Alors "alice" lit la page 3 du numéro 37 avec l'accès "SUBSCRIPTION"
    Et le renouvellement de "alice" est refusé tant que l'échéance est à plus de 60 jours

  Scénario: La rédaction publie une actualité lisible par tous
    Quand "admin-pme" publie l'actualité "Soirée de clôture du festival (acceptation)"
    Alors un visiteur lit cette actualité
    Et "carol" ne peut pas publier d'actualité
