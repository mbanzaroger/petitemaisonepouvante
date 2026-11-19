package com.petitemaisonepouvante.editorial.subscription;

import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.editorial.observability.EditorialMetrics;
import com.petitemaisonepouvante.editorial.security.Member;
import com.petitemaisonepouvante.editorial.web.Problems;

/**
 * US17 — abonnement annuel au fanzine (numérique, ou papier et numérique) et renouvellement. Paiement simulé
 * (démonstrateur, aucun paiement réel) : chaque souscription est historisée avec son montant.
 */
@Service
public class SubscriptionService {

    /** Le renouvellement est ouvert dans les 60 jours précédant l'échéance, ou après. */
    static final int RENEWAL_WINDOW_DAYS = 60;
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final SubscriptionRepository subscriptions;
    private final EditorialMetrics metrics;
    private final Clock clock;

    public SubscriptionService(SubscriptionRepository subscriptions, EditorialMetrics metrics, Clock clock) {
        this.subscriptions = subscriptions;
        this.metrics = metrics;
        this.clock = clock;
    }

    public LocalDate today() {
        return LocalDate.now(clock);
    }

    @Transactional(readOnly = true)
    public Optional<Subscription> current(String memberId) {
        return subscriptions.find(memberId);
    }

    @Transactional(readOnly = true)
    public boolean isActive(String memberId) {
        return memberId != null && subscriptions.find(memberId).filter(s -> s.activeOn(today())).isPresent();
    }

    public boolean renewable(Subscription subscription) {
        return ChronoUnit.DAYS.between(today(), subscription.endsOn()) <= RENEWAL_WINDOW_DAYS;
    }

    @Transactional
    public Subscription subscribe(Member member, SubscriptionRequest request) {
        Optional<Subscription> existing = subscriptions.find(member.id());
        if (existing.filter(s -> s.activeOn(today())).isPresent()) {
            throw Problems.conflict("Vous avez déjà un abonnement en cours : renouvelez-le à l'approche de l'échéance.");
        }
        LocalDate start = today();
        Subscription subscription = new Subscription(member.id(), member.name(), request.plan(), start,
                start.plusYears(1).minusDays(1), address(request));
        subscriptions.save(subscription);
        subscriptions.insertEvent(member.id(), "NEW", request.plan(), request.plan().priceCents());
        metrics.subscription("new", request.plan().name());
        return subscription;
    }

    /** Prolonge d'un an à partir de l'échéance (ou d'aujourd'hui si l'abonnement a expiré) ; la formule peut changer. */
    @Transactional
    public Subscription renew(Member member, SubscriptionRequest request) {
        Subscription current = subscriptions.find(member.id())
                .orElseThrow(() -> Problems.notFound("Aucun abonnement à renouveler"));
        if (!renewable(current)) {
            throw Problems.conflict("Le renouvellement sera possible à partir du "
                    + current.endsOn().minusDays(RENEWAL_WINDOW_DAYS).format(DATE) + " (échéance le "
                    + current.endsOn().format(DATE) + ").");
        }
        LocalDate from = current.activeOn(today()) ? current.endsOn().plusDays(1) : today();
        LocalDate start = current.activeOn(today()) ? current.startsOn() : today();
        Subscription renewed = new Subscription(member.id(), member.name(), request.plan(), start,
                from.plusYears(1).minusDays(1), address(request));
        subscriptions.save(renewed);
        subscriptions.insertEvent(member.id(), "RENEWAL", request.plan(), request.plan().priceCents());
        metrics.subscription("renewal", request.plan().name());
        return renewed;
    }

    @Transactional(readOnly = true)
    public List<Subscription> paperSubscribers() {
        return subscriptions.findActivePaper(today());
    }

    private static Address address(SubscriptionRequest request) {
        if (!request.plan().paper()) {
            return null;
        }
        if (request.address() == null) {
            throw Problems.rejected("Une adresse de livraison est requise pour l'abonnement papier.");
        }
        return request.address().strip();
    }
}
