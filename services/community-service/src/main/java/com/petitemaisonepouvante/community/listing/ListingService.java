package com.petitemaisonepouvante.community.listing;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.community.notification.NotificationService;
import com.petitemaisonepouvante.community.notification.NotificationType;
import com.petitemaisonepouvante.community.observability.CommunityMetrics;
import com.petitemaisonepouvante.community.offer.OfferRepository;
import com.petitemaisonepouvante.community.security.Member;
import com.petitemaisonepouvante.community.web.Problems;

/** US8 — publier, consulter et retirer des annonces de troc ou de don. */
@Service
public class ListingService {

    static final String NOT_FOUND = "Annonce introuvable";

    private final ListingRepository listings;
    private final OfferRepository offers;
    private final NotificationService notifications;
    private final CommunityMetrics metrics;

    public ListingService(ListingRepository listings, OfferRepository offers, NotificationService notifications,
            CommunityMetrics metrics) {
        this.listings = listings;
        this.offers = offers;
        this.notifications = notifications;
        this.metrics = metrics;
    }

    @Transactional
    public Listing publish(Member author, NewListingRequest request) {
        // Une contrepartie n'a de sens que pour un échange ; un don n'en a pas.
        String wanted = request.type() == ListingType.EXCHANGE ? clean(request.wanted()) : null;
        Listing listing = listings.insert(author.id(), author.name(), request.type(), request.title().strip(),
                request.description().strip(), request.category(), request.condition(), wanted);
        notifications.notifyInterestMatches(listing, notifications.notifyWishMatches(listing));
        metrics.listingPublished(listing.type().name());
        return listing;
    }

    @Transactional(readOnly = true)
    public Listing visible(UUID id, Member viewer) {
        return listings.findById(id).filter(listing -> listing.visibleTo(viewer))
                .orElseThrow(() -> Problems.notFound(NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public List<Listing> mine(Member member) {
        return listings.findByOwner(member.id());
    }

    /** Retrait par l'auteur : les propositions en attente sont refusées et leurs auteurs prévenus. */
    @Transactional
    public void withdraw(Member member, UUID id) {
        Listing listing = listings.findByIdForUpdate(id).filter(found -> found.ownedBy(member))
                .orElseThrow(() -> Problems.notFound(NOT_FOUND));
        if (listing.status() != ListingStatus.ACTIVE) {
            throw Problems.conflict("Seule une annonce en cours peut être retirée.");
        }
        listings.updateStatus(id, ListingStatus.WITHDRAWN);
        offers.declineAllPending(id, null).forEach(declined -> notifications.notify(declined.authorId(),
                NotificationType.OFFER_DECLINED,
                "L'annonce « " + listing.title() + " » a été retirée par son auteur.",
                "/communaute/propositions/" + declined.id()));
    }

    private static String clean(String text) {
        return text == null || text.isBlank() ? null : text.strip();
    }
}
