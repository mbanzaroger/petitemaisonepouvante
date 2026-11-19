package com.petitemaisonepouvante.editorial.observability;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * Métriques métier des éditions, exposées sur /actuator/prometheus :
 * <ul>
 *   <li>{@code pme_editorial_issue_purchases_total} : numéros numériques achetés ;</li>
 *   <li>{@code pme_editorial_subscriptions_total{event,plan}} : abonnements souscrits ou renouvelés ;</li>
 *   <li>{@code pme_editorial_pages_read_total{access}} : pages lues dans la liseuse (extrait, achat, abonnement) ;</li>
 *   <li>{@code pme_editorial_articles_published_total} : actualités et articles publiés.</li>
 * </ul>
 */
@Component
public class EditorialMetrics {

    private final MeterRegistry registry;

    public EditorialMetrics(MeterRegistry registry) {
        this.registry = registry;
        Counter.builder("pme.editorial.issue.purchases").register(registry);
        Counter.builder("pme.editorial.articles.published").register(registry);
        for (String event : new String[] {"new", "renewal"}) {
            for (String plan : new String[] {"DIGITAL", "PAPER_DIGITAL"}) {
                Counter.builder("pme.editorial.subscriptions").tag("event", event).tag("plan", plan).register(registry);
            }
        }
        for (String access : new String[] {"preview", "purchase", "subscription"}) {
            Counter.builder("pme.editorial.pages.read").tag("access", access).register(registry);
        }
    }

    public void issuePurchased() {
        afterCommit(Counter.builder("pme.editorial.issue.purchases").register(registry));
    }

    public void articlePublished() {
        afterCommit(Counter.builder("pme.editorial.articles.published").register(registry));
    }

    public void subscription(String event, String plan) {
        afterCommit(Counter.builder("pme.editorial.subscriptions").tag("event", event).tag("plan", plan)
                .register(registry));
    }

    public void pageRead(String access) {
        Counter.builder("pme.editorial.pages.read").tag("access", access).register(registry).increment();
    }

    private static void afterCommit(Counter counter) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    counter.increment();
                }
            });
        } else {
            counter.increment();
        }
    }
}
