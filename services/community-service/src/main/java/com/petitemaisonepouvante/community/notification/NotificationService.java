package com.petitemaisonepouvante.community.notification;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.community.listing.Category;
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
    /** Score de navigation à partir duquel une catégorie est considérée comme un centre d'intérêt. */
    static final int INTEREST_THRESHOLD = 3;
    static final int INTEREST_DAYS = 180;

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

    /**
     * Prévient les membres qui recherchent un objet correspondant à la nouvelle annonce.
     *
     * @return les membres concernés (ils ne reçoivent pas en plus une notification de navigation)
     */
    public Set<String> notifyWishMatches(Listing listing) {
        String text = listing.title() + " " + listing.description();
        Set<String> matched = new HashSet<>();
        repository.findWishMatches(text, listing.ownerId()).forEach(match -> {
            matched.add(match.memberId());
            notify(match.memberId(), NotificationType.WISH_MATCH,
                    "Nouvelle annonce pour votre recherche « " + match.keywords() + " » : " + listing.title(),
                    "/communaute/annonces/" + listing.id());
        });
        return matched;
    }

    /** US14 — prévient les membres qui consultent souvent la catégorie de l'annonce (s'ils l'ont accepté). */
    public void notifyInterestMatches(Listing listing, Set<String> alreadyNotified) {
        repository.findInterestedMembers(listing.category().name(), listing.ownerId(), INTEREST_THRESHOLD, INTEREST_DAYS)
                .stream()
                .filter(memberId -> !alreadyNotified.contains(memberId))
                .forEach(memberId -> notify(memberId, NotificationType.INTEREST_MATCH,
                        "Nouvelle annonce dans une catégorie que vous consultez souvent (« "
                                + listing.category().label() + " ») : " + listing.title(),
                        "/communaute/annonces/" + listing.id()));
    }

    /**
     * Enregistre une consultation (1 point) ou une recherche par catégorie (2 points), uniquement si le membre a
     * activé les notifications selon sa navigation (consentement).
     */
    @Transactional
    public void recordBrowsing(Member member, Category category, int points) {
        if (member != null && repository.findPreferences(member.id()).browsing()) {
            repository.addInterest(member.id(), category.name(), points);
        }
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

    /** Retirer son accord aux notifications de navigation efface les centres d'intérêt déjà enregistrés. */
    @Transactional
    public Preferences savePreferences(Member member, Preferences preferences) {
        repository.savePreferences(member.id(), preferences);
        if (!preferences.browsing()) {
            repository.deleteInterests(member.id());
        }
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
