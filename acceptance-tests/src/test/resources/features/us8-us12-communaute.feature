# language: fr
Fonctionnalité: US8 à US12 — Espace communautaire (troc, dons, discussions)
  En tant que membre passionné, je veux échanger des objets avec d'autres membres et discuter avec eux.

  Scénario: Une proposition acceptée conclut l'annonce et prévient les deux membres
    Étant donné "alice" publie l'annonce d'échange "Figurine à échanger (acceptation)"
    Quand "carol" propose un échange sur cette annonce
    Alors "alice" est notifiée d'une nouvelle proposition
    Quand "alice" accepte la proposition
    Alors la proposition est "ACCEPTED" et l'annonce est "CONCLUDED"
    Et "carol" est notifiée de l'acceptation

  Scénario: Une proposition n'est visible que de ses deux participants
    Étant donné "alice" publie l'annonce d'échange "Figurine à échanger (confidentialité)"
    Quand "carol" propose un échange sur cette annonce
    Alors "admin-pme" ne voit pas la proposition
    Et "bob" ne peut pas publier d'annonce

  Scénario: Les membres discutent dans un salon
    Quand "alice" écrit "Bonsoir les passionnés (acceptation)" dans le salon "films"
    Alors "carol" lit "Bonsoir les passionnés (acceptation)" dans le salon "films"
