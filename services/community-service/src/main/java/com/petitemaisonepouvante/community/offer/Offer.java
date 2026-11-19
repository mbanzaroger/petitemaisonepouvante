package com.petitemaisonepouvante.community.offer;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.petitemaisonepouvante.community.listing.ListingStatus;
import com.petitemaisonepouvante.community.security.Member;

/**
 * Proposition d'échange (ou demande de don) faite sur une annonce, avec les informations de l'annonce utiles aux
 * contrôles d'accès : seuls l'auteur de la proposition et celui de l'annonce y ont accès.
 */
public record Offer(UUID id, UUID listingId, String listingTitle, String listingOwnerId, String listingOwnerName,
        ListingStatus listingStatus, String authorId, String authorName, String message, OfferStatus status,
        OffsetDateTime createdAt, OffsetDateTime updatedAt) {

    public boolean madeBy(Member member) {
        return member != null && authorId.equals(member.id());
    }

    public boolean receivedBy(Member member) {
        return member != null && listingOwnerId.equals(member.id());
    }

    public boolean involves(Member member) {
        return madeBy(member) || receivedBy(member);
    }

    /** Identifiant de l'autre participant de la conversation. */
    public String counterpartOf(Member member) {
        return madeBy(member) ? listingOwnerId : authorId;
    }

    /** Les échanges de messages restent possibles tant que la proposition est en attente ou acceptée. */
    public boolean open() {
        return status == OfferStatus.PENDING || status == OfferStatus.ACCEPTED;
    }

    /** Proposition close (refusée, annulée) : identifiant et auteur, pour prévenir ce dernier. */
    public record Closed(UUID id, String authorId) {
    }
}
