package com.petitemaisonepouvante.community.listing;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.petitemaisonepouvante.community.security.Member;

/** Annonce de troc : un objet proposé à l'échange (contre ce que l'auteur recherche) ou donné. */
public record Listing(UUID id, String ownerId, String ownerName, ListingType type, String title, String description,
        Category category, ItemCondition condition, String wanted, ListingStatus status, OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public boolean ownedBy(Member member) {
        return member != null && ownerId.equals(member.id());
    }

    /** Annonce en cours ou conclue : consultable par tous. Retirée ou masquée : par son auteur et la modération. */
    public boolean visibleTo(Member member) {
        return status == ListingStatus.ACTIVE || status == ListingStatus.CONCLUDED
                || ownedBy(member) || (member != null && member.admin());
    }
}
