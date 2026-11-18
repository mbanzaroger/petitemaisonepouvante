package com.petitemaisonepouvante.community.listing;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.petitemaisonepouvante.community.security.Member;

/** Annonce telle que présentée : nom affiché de l'auteur seulement (son identifiant n'est jamais exposé). */
public record ListingDto(UUID id, ListingType type, String title, String description, Category category,
        ItemCondition condition, String wanted, ListingStatus status, String ownerName, boolean mine,
        OffsetDateTime createdAt) {

    public static ListingDto from(Listing listing, Member viewer) {
        return new ListingDto(listing.id(), listing.type(), listing.title(), listing.description(), listing.category(),
                listing.condition(), listing.wanted(), listing.status(), listing.ownerName(), listing.ownedBy(viewer),
                listing.createdAt());
    }
}
