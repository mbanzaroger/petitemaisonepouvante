package com.petitemaisonepouvante.catalog.recommendation;

/** Nature d'un signal d'intérêt et son poids dans le calcul des recommandations. */
public enum InterestKind {
    VIEW(1), SEARCH(2), PURCHASE(4);

    private final int weight;

    InterestKind(int weight) {
        this.weight = weight;
    }

    public int weight() {
        return weight;
    }
}
