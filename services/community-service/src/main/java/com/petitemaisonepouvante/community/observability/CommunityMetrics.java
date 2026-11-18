package com.petitemaisonepouvante.community.observability;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.petitemaisonepouvante.community.moderation.ReportRepository;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * Métriques métier de l'espace communautaire, exposées sur /actuator/prometheus à côté des métriques RED :
 * <ul>
 *   <li>{@code pme_community_listings_total{type}} : annonces publiées (échange ou don) ;</li>
 *   <li>{@code pme_community_offers_total{event}} : propositions faites, acceptées, refusées, annulées ;</li>
 *   <li>{@code pme_community_messages_total{channel}} : messages envoyés dans un salon ou une proposition ;</li>
 *   <li>{@code pme_community_reports_total{event}} : signalements déposés, contenus masqués, signalements rejetés ;</li>
 *   <li>{@code pme_community_reports_open} : signalements en attente de modération (alerte si la file s'allonge).</li>
 * </ul>
 * Les compteurs ne bougent qu'après validation de la transaction.
 */
@Component
public class CommunityMetrics {

    private final MeterRegistry registry;

    public CommunityMetrics(MeterRegistry registry, ReportRepository reports) {
        this.registry = registry;
        Gauge.builder("pme.community.reports.open", reports, ReportRepository::countOpen)
                .description("Signalements en attente de modération")
                .register(registry);
        // Séries créées dès le démarrage : les tableaux de bord et alertes ont une valeur 0 plutôt qu'aucune donnée.
        for (String type : new String[] {"EXCHANGE", "GIFT"}) {
            counter("pme.community.listings", "type", type);
        }
        for (String event : new String[] {"made", "accepted", "declined", "cancelled"}) {
            counter("pme.community.offers", "event", event);
        }
        for (String channel : new String[] {"room", "offer"}) {
            counter("pme.community.messages", "channel", channel);
        }
        for (String event : new String[] {"filed", "hidden", "dismissed"}) {
            counter("pme.community.reports", "event", event);
        }
    }

    public void listingPublished(String type) {
        increment("pme.community.listings", "type", type);
    }

    public void offer(String event) {
        increment("pme.community.offers", "event", event);
    }

    public void message(String channel) {
        increment("pme.community.messages", "channel", channel);
    }

    public void report(String event) {
        increment("pme.community.reports", "event", event);
    }

    private Counter counter(String name, String tag, String value) {
        return Counter.builder(name).tag(tag, value).register(registry);
    }

    private void increment(String name, String tag, String value) {
        Counter counter = counter(name, tag, value);
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
