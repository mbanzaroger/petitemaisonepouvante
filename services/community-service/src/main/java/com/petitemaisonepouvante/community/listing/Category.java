package com.petitemaisonepouvante.community.listing;

/** Catégories d'objets échangés (proches de celles du catalogue), avec leur libellé affiché. */
public enum Category {
    FIGURINES("Figurines"),
    BLURAY("Films et Blu-ray"),
    BOARD_GAMES("Jeux de société"),
    BOOKS_COMICS("Livres et BD"),
    POSTERS("Affiches"),
    GOODIES("Goodies"),
    OTHER("Autre");

    private final String label;

    Category(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
