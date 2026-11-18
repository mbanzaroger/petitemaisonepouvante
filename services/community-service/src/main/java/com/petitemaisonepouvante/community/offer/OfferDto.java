package com.petitemaisonepouvante.community.offer;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.petitemaisonepouvante.community.listing.ListingStatus;
import com.petitemaisonepouvante.community.security.Member;

/** Proposition vue par l'un de ses deux participants ({@code sent} : faite par le membre qui consulte). */
public record OfferDto(UUID id, UUID listingId, String listingTitle, ListingStatus listingStatus, OfferStatus status,
        String message, String authorName, String ownerName, boolean sent, OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    public static OfferDto from(Offer offer, Member viewer) {
        return new OfferDto(offer.id(), offer.listingId(), offer.listingTitle(), offer.listingStatus(), offer.status(),
                offer.message(), offer.authorName(), offer.listingOwnerName(), offer.madeBy(viewer), offer.createdAt(),
                offer.updatedAt());
    }

    /** Propositions envoyées et reçues par le membre. */
    public record Mine(List<OfferDto> sent, List<OfferDto> received) {
    }
}
