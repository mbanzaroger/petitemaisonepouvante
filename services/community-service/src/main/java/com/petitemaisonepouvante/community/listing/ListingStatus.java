package com.petitemaisonepouvante.community.listing;

/** Cycle de vie d'une annonce : en cours, conclue (proposition acceptée), retirée par son auteur, masquée par la modération. */
public enum ListingStatus {
    ACTIVE, CONCLUDED, WITHDRAWN, HIDDEN
}
