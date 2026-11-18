package com.petitemaisonepouvante.community.moderation;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.community.chat.ChatMessage;
import com.petitemaisonepouvante.community.chat.MessageRepository;
import com.petitemaisonepouvante.community.listing.Listing;
import com.petitemaisonepouvante.community.listing.ListingRepository;
import com.petitemaisonepouvante.community.listing.ListingStatus;
import com.petitemaisonepouvante.community.notification.NotificationService;
import com.petitemaisonepouvante.community.notification.NotificationType;
import com.petitemaisonepouvante.community.observability.CommunityMetrics;
import com.petitemaisonepouvante.community.offer.OfferRepository;
import com.petitemaisonepouvante.community.offer.OfferService;
import com.petitemaisonepouvante.community.security.Member;
import com.petitemaisonepouvante.community.web.Problems;

/**
 * US12 — signalement par les membres et modération par les administrateurs : masquer un contenu (l'auteur est
 * prévenu) ou rejeter le signalement. Un membre ne peut signaler que ce qu'il voit.
 */
@Service
public class ReportService {

    static final String NOT_FOUND = "Contenu introuvable";
    static final String PERSONAL_SPACE = "/mon-espace";

    private final ReportRepository reports;
    private final ListingRepository listings;
    private final MessageRepository messages;
    private final OfferRepository offers;
    private final NotificationService notifications;
    private final CommunityMetrics metrics;

    public ReportService(ReportRepository reports, ListingRepository listings, MessageRepository messages,
            OfferRepository offers, NotificationService notifications, CommunityMetrics metrics) {
        this.reports = reports;
        this.listings = listings;
        this.messages = messages;
        this.offers = offers;
        this.notifications = notifications;
        this.metrics = metrics;
    }

    @Transactional
    public void report(Member member, NewReportRequest request) {
        String targetId;
        String authorId;
        if (request.targetType() == TargetType.LISTING) {
            Listing listing = visibleListing(member, request.targetId());
            targetId = listing.id().toString();
            authorId = listing.ownerId();
        } else {
            ChatMessage message = visibleMessage(member, request.targetId());
            targetId = Long.toString(message.id());
            authorId = message.authorId();
        }
        if (authorId.equals(member.id())) {
            throw Problems.rejected("Vous ne pouvez pas signaler votre propre contenu.");
        }
        if (reports.insert(request.targetType(), targetId, member.id(), member.name(), request.reason().strip())) {
            metrics.report("filed");
        }
    }

    @Transactional(readOnly = true)
    public List<Report> reports(ReportStatus status) {
        return reports.findByStatus(status);
    }

    /** Masque le contenu signalé, clôt tous les signalements qui le visent et prévient son auteur. */
    @Transactional
    public void hide(Member moderator, UUID reportId) {
        Report report = open(reportId);
        String text;
        if (report.targetType() == TargetType.LISTING) {
            UUID listingId = UUID.fromString(report.targetId());
            listings.findByIdForUpdate(listingId);
            listings.updateStatus(listingId, ListingStatus.HIDDEN);
            offers.declineAllPending(listingId, null).forEach(closed -> notifications.notify(closed.authorId(),
                    NotificationType.OFFER_DECLINED,
                    "L'annonce « " + report.excerpt() + " » n'est plus disponible.", OfferService.link(closed.id())));
            text = "Votre annonce « " + report.excerpt() + " » a été masquée par la modération : elle ne respecte pas "
                    + "la charte de l'espace communautaire.";
        } else {
            messages.hide(Long.parseLong(report.targetId()));
            text = "Un de vos messages a été masqué par la modération : il ne respecte pas la charte de l'espace "
                    + "communautaire.";
        }
        reports.closeOpen(report.targetType(), report.targetId(), ReportStatus.ACTIONED, moderator.name());
        if (report.targetAuthorId() != null) {
            notifications.notify(report.targetAuthorId(), NotificationType.CONTENT_HIDDEN, text, PERSONAL_SPACE);
        }
        metrics.report("hidden");
    }

    @Transactional
    public void dismiss(Member moderator, UUID reportId) {
        Report report = open(reportId);
        reports.close(report.id(), ReportStatus.DISMISSED, moderator.name());
        metrics.report("dismissed");
    }

    private Report open(UUID id) {
        Report report = reports.findById(id).orElseThrow(() -> Problems.notFound("Signalement introuvable"));
        if (report.status() != ReportStatus.OPEN) {
            throw Problems.conflict("Ce signalement a déjà été traité.");
        }
        return report;
    }

    private Listing visibleListing(Member member, String id) {
        UUID listingId;
        try {
            listingId = UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            throw Problems.notFound(NOT_FOUND);
        }
        return listings.findById(listingId).filter(listing -> listing.visibleTo(member))
                .orElseThrow(() -> Problems.notFound(NOT_FOUND));
    }

    /** Message d'un salon (visible de tous les membres) ou d'une proposition dont le membre est participant. */
    private ChatMessage visibleMessage(Member member, String id) {
        long messageId;
        try {
            messageId = Long.parseLong(id);
        } catch (NumberFormatException e) {
            throw Problems.notFound(NOT_FOUND);
        }
        ChatMessage message = messages.findById(messageId).filter(found -> !found.hidden())
                .orElseThrow(() -> Problems.notFound(NOT_FOUND));
        if (message.offerId() != null
                && offers.findById(message.offerId()).filter(offer -> offer.involves(member)).isEmpty()) {
            throw Problems.notFound(NOT_FOUND);
        }
        return message;
    }
}
