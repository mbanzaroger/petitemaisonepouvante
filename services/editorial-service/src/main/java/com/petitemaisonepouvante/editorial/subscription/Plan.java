package com.petitemaisonepouvante.editorial.subscription;

/** Formules d'abonnement annuel au fanzine (le numérique est inclus dans les deux). Prix en centimes. */
public enum Plan {
    DIGITAL("Numérique", 2400, false),
    PAPER_DIGITAL("Papier et numérique", 3900, true);

    private final String label;
    private final int priceCents;
    private final boolean paper;

    Plan(String label, int priceCents, boolean paper) {
        this.label = label;
        this.priceCents = priceCents;
        this.paper = paper;
    }

    public String label() {
        return label;
    }

    public int priceCents() {
        return priceCents;
    }

    /** La formule papier exige une adresse de livraison. */
    public boolean paper() {
        return paper;
    }
}
