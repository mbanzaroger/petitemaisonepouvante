package com.petitemaisonepouvante.community.offer;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.community.chat.ChatMessage;
import com.petitemaisonepouvante.community.chat.MessageService;
import com.petitemaisonepouvante.community.listing.Listing;
import com.petitemaisonepouvante.community.listing.ListingRepository;
import com.petitemaisonepouvante.community.listing.ListingStatus;
import com.petitemaisonepouvante.community.listing.ListingType;
import com.petitemaisonepouvante.community.notification.NotificationService;
import com.petitemaisonepouvante.community.notification.NotificationType;
import com.petitemaisonepouvante.community.observability.CommunityMetrics;
import com.petitemaisonepouvante.community.security.Member;
import com.petitemaisonepouvante.community.web.Problems;

/**
 * US9 — proposer un échange ou demander un don, accepter ou refuser, et convenir de la remise par messages privés.
 * Verrous toujours pris dans le même ordre (annonce puis proposition) pour éviter les interblocages.
 */
@Service
public class OfferService {

    static final String NOT_FOUND = "Proposition introuvable";

    private final OfferRepository offers;
    private final ListingRepository listings;
    private final MessageService messages;
    private final NotificationService notifications;
    private final CommunityMetrics metrics;

    public OfferService(OfferRepository offers, ListingRepository listings, MessageService messages,
            NotificationService notifications, CommunityMetrics metrics) {
        this.offers = offers;
        this.listings = listings;
        this.messages = messages;
        this.notifications = notifications;
        this.metrics = metrics;
    }

    @Transactional
    public Offer make(Member member, UUID listingId, String message) {
        Listing listing = listings.findByIdForUpdate(listingId).filter(found -> found.visibleTo(member))
                .orElseThrow(() -> Problems.notFound("Annonce introuvable"));
        if (listing.ownedBy(member)) {
            throw Problems.rejected("Vous ne pouvez pas faire de proposition sur votre propre annonce.");
        }
        if (listing.status() != ListingStatus.ACTIVE) {
            throw Problems.conflict("Cette annonce n'est plus disponible.");
        }
        if (offers.existsPending(listingId, member.id())) {
            throw Problems.conflict("Vous avez déjà une proposition en attente sur cette annonce.");
        }
        String text = message.strip();
        UUID id = offers.insert(listingId, member.id(), member.name(), text);
        // Le message de la proposition ouvre la conversation privée entre les deux membres.
        messages.postInOffer(member, id, text);
        String action = listing.type() == ListingType.GIFT ? " souhaite recevoir votre don « " : " vous propose un échange pour « ";
        notifications.notify(listing.ownerId(), NotificationType.NEW_OFFER,
                member.name() + action + listing.title() + " ».", link(id));
        metrics.offer("made");
        return reload(id);
    }

    @Transactional(readOnly = true)
    public Offer get(Member member, UUID id) {
        return offers.findById(id).filter(offer -> offer.involves(member))
                .orElseThrow(() -> Problems.notFound(NOT_FOUND));
    }

    @Transactional(readOnly = true)
    public List<Offer> involving(Member member) {
        return offers.findInvolving(member.id());
    }

    /** Acceptation : l'annonce est conclue, les autres propositions en attente sont refusées et leurs auteurs prévenus. */
    @Transactional
    public Offer accept(Member member, UUID id) {
        Offer offer = lock(member, id);
        if (!offer.receivedBy(member)) {
            throw Problems.forbidden("Seul l'auteur de l'annonce peut accepter une proposition.");
        }
        requirePending(offer);
        if (offer.listingStatus() != ListingStatus.ACTIVE) {
            throw Problems.conflict("Cette annonce n'est plus disponible.");
        }
        offers.updateStatus(id, OfferStatus.ACCEPTED);
        listings.updateStatus(offer.listingId(), ListingStatus.CONCLUDED);
        notifications.notify(offer.authorId(), NotificationType.OFFER_ACCEPTED,
                member.name() + " a accepté votre proposition pour « " + offer.listingTitle()
                        + " » : convenez ensemble de la remise de l'objet.", link(id));
        offers.declineAllPending(offer.listingId(), id).forEach(closed -> notifications.notify(closed.authorId(),
                NotificationType.OFFER_DECLINED,
                "L'annonce « " + offer.listingTitle() + " » a été conclue avec un autre membre.", link(closed.id())));
        metrics.offer("accepted");
        return reload(id);
    }

    @Transactional
    public Offer decline(Member member, UUID id) {
        Offer offer = lock(member, id);
        if (!offer.receivedBy(member)) {
            throw Problems.forbidden("Seul l'auteur de l'annonce peut refuser une proposition.");
        }
        requirePending(offer);
        offers.updateStatus(id, OfferStatus.DECLINED);
        notifications.notify(offer.authorId(), NotificationType.OFFER_DECLINED,
                member.name() + " a décliné votre proposition pour « " + offer.listingTitle() + " ».", link(id));
        metrics.offer("declined");
        return reload(id);
    }

    @Transactional
    public Offer cancel(Member member, UUID id) {
        Offer offer = lock(member, id);
        if (!offer.madeBy(member)) {
            throw Problems.forbidden("Seul l'auteur de la proposition peut l'annuler.");
        }
        requirePending(offer);
        offers.updateStatus(id, OfferStatus.CANCELLED);
        notifications.notify(offer.listingOwnerId(), NotificationType.OFFER_CANCELLED,
                member.name() + " a annulé sa proposition pour « " + offer.listingTitle() + " ».", link(id));
        metrics.offer("cancelled");
        return reload(id);
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> messages(Member member, UUID id, long after) {
        get(member, id);
        return messages.offerMessages(id, after);
    }

    /** Message privé : l'autre participant est prévenu une fois, tant qu'il n'a pas lu ses notifications. */
    @Transactional
    public ChatMessage postMessage(Member member, UUID id, String content) {
        Offer offer = get(member, id);
        if (!offer.open()) {
            throw Problems.conflict("Cette conversation est close : la proposition a été refusée ou annulée.");
        }
        ChatMessage message = messages.postInOffer(member, id, content.strip());
        offers.touch(id);
        notifications.notifyOnce(offer.counterpartOf(member), NotificationType.NEW_MESSAGE,
                "Nouveau message de " + member.name() + " à propos de « " + offer.listingTitle() + " ».", link(id));
        return message;
    }

    public static String link(UUID offerId) {
        return "/communaute/propositions/" + offerId;
    }

    private Offer lock(Member member, UUID id) {
        Offer offer = get(member, id);
        listings.findByIdForUpdate(offer.listingId());
        return offers.findByIdForUpdate(id).orElseThrow(() -> Problems.notFound(NOT_FOUND));
    }

    private static void requirePending(Offer offer) {
        if (offer.status() != OfferStatus.PENDING) {
            throw Problems.conflict("Cette proposition a déjà été traitée.");
        }
    }

    private Offer reload(UUID id) {
        return offers.findById(id).orElseThrow(() -> Problems.notFound(NOT_FOUND));
    }
}
