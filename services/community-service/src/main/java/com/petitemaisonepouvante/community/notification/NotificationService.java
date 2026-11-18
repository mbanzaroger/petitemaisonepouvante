package com.petitemaisonepouvante.community.notification;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.community.listing.Listing;
import com.petitemaisonepouvante.community.security.Member;
import com.petitemaisonepouvante.community.web.Problems;

/**
 * US11 — notifications internes au site, selon les préférences du membre, et liste d'objets recherchés.
 * Les notifications sont écrites dans la transaction de l'action qui les déclenche : pas de notification
 * pour une action annulée.
 */
@Service
public class NotificationService {

    /** Nombre maximal d'objets recherchés par membre (anti-abus). */
    static final int MAX_WISHES = 10;
    static final int LATEST = 50;
    static final int MAX_TEXT = 300;

    private final NotificationRepository repository;

    public NotificationService(NotificationRepository repository) {
        this.repository = repository;
    }

    public void notify(String memberId, NotificationType type, String text, String link) {
        if (repository.findPreferences(memberId).accepts(type)) {
            repository.insert(memberId, type, truncate(text), link);
        }
    }

    /** Une seule notification non lue par conversation : pas d'avalanche à chaque message. */
    public void notifyOnce(String memberId, NotificationType type, String text, String link) {
        if (!repository.existsUnread(memberId, type, link)) {
            notify(memberId, type, text, link);
        }
    }

    /** Prévient les membres qui recherchent un objet correspondant à la nouvelle annonce. */
    public void notifyWishMatches(Listing listing) {
        String text = listing.title() + " " + listing.description();
        repository.findWishMatches(text, listing.ownerId()).forEach(match -> notify(match.memberId(),
                NotificationType.WISH_MATCH,
                "Nouvelle annonce pour votre recherche « " + match.keywords() + " » : " + listing.title(),
                "/communaute/annonces/" + listing.id()));
    }

    @Transactional(readOnly = true)
    public List<Notification> latest(Member member) {
        return repository.findLatest(member.id(), LATEST);
    }

    @Transactional(readOnly = true)
    public long unread(Member member) {
        return repository.countUnread(member.id());
    }

    @Transactional
    public void markAllRead(Member member) {
        repository.markAllRead(member.id());
    }

    @Transactional(readOnly = true)
    public Preferences preferences(Member member) {
        return repository.findPreferences(member.id());
    }

    @Transactional
    public Preferences savePreferences(Member member, Preferences preferences) {
        repository.savePreferences(member.id(), preferences);
        return preferences;
    }

    @Transactional(readOnly = true)
    public List<Wish> wishes(Member member) {
        return repository.findWishes(member.id());
    }

    @Transactional
    public Wish addWish(Member member, String keywords) {
        if (repository.countWishes(member.id()) >= MAX_WISHES) {
            throw Problems.rejected("Vous suivez déjà " + MAX_WISHES + " recherches : supprimez-en une pour en ajouter.");
        }
        return repository.insertWish(member.id(), keywords.strip().replaceAll("\\s+", " "))
                .orElseThrow(() -> Problems.conflict("Cette recherche est déjà dans votre liste."));
    }

    @Transactional
    public void removeWish(Member member, UUID id) {
        if (!repository.deleteWish(id, member.id())) {
            throw Problems.notFound("Recherche introuvable");
        }
    }

    static String truncate(String text) {
        return text.length() <= MAX_TEXT ? text : text.substring(0, MAX_TEXT - 1) + "…";
    }
}
