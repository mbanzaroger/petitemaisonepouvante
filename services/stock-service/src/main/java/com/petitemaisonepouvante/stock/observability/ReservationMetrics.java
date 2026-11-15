package com.petitemaisonepouvante.stock.observability;

import java.util.EnumMap;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.petitemaisonepouvante.stock.messaging.OutboxRepository;
import com.petitemaisonepouvante.stock.reservation.ReservationService.Outcome;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

/**
 * US5 : métriques métier de l'étape 2 de la saga, exposées sur /actuator/prometheus.
 * <ul>
 *   <li>{@code pme_stock_reservations_total{outcome}} : réservations acceptées, refusées ou doublons ignorés
 *       (un doublon prouve en production l'idempotence validée par l'expérimentation E3) ;</li>
 *   <li>{@code pme_outbox_pending} : événements en attente de publication.</li>
 * </ul>
 */
@Component
public class ReservationMetrics {

    private final Map<Outcome, Counter> reservations = new EnumMap<>(Outcome.class);

    public ReservationMetrics(MeterRegistry registry, OutboxRepository outbox) {
        for (Outcome outcome : Outcome.values()) {
            reservations.put(outcome, Counter.builder("pme.stock.reservations")
                    .description("Demandes de réservation de stock par issue")
                    .tag("outcome", outcome.name().toLowerCase(Locale.ROOT))
                    .register(registry));
        }
        Gauge.builder("pme.outbox.pending", outbox, OutboxRepository::countPending)
                .description("Événements de la boîte d'envoi pas encore publiés")
                .register(registry);
    }

    /** Appelé après le retour de la méthode transactionnelle, donc après validation de la transaction. */
    public void record(Outcome outcome) {
        reservations.get(outcome).increment();
    }
}
