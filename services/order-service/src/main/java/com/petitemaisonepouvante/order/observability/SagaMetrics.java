package com.petitemaisonepouvante.order.observability;

import java.time.Duration;

import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.petitemaisonepouvante.order.domain.OrderStatus;
import com.petitemaisonepouvante.order.messaging.OutboxRepository;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;

/**
 * US5 : métriques métier de la saga de commande, exposées sur /actuator/prometheus à côté des métriques RED.
 * <ul>
 *   <li>{@code pme_orders_total{event}} : commandes créées, confirmées ou annulées ;</li>
 *   <li>{@code pme_saga_duration_seconds} : durée entre la création et l'état final (histogramme, p95) ;</li>
 *   <li>{@code pme_outbox_pending} : événements en attente de publication (broker indisponible si elle grossit).</li>
 * </ul>
 * Les compteurs ne bougent qu'après validation de la transaction : une commande annulée par un rollback
 * n'est jamais comptée.
 */
@Component
public class SagaMetrics {

    private final Counter placed;
    private final Counter confirmed;
    private final Counter cancelled;
    private final Timer sagaDuration;

    public SagaMetrics(MeterRegistry registry, OutboxRepository outbox) {
        this.placed = orders(registry, "placed");
        this.confirmed = orders(registry, "confirmed");
        this.cancelled = orders(registry, "cancelled");
        this.sagaDuration = Timer.builder("pme.saga.duration")
                .description("Durée entre la création d'une commande et son état final")
                .publishPercentileHistogram()
                .register(registry);
        Gauge.builder("pme.outbox.pending", outbox, OutboxRepository::countPending)
                .description("Événements de la boîte d'envoi pas encore publiés")
                .register(registry);
    }

    private static Counter orders(MeterRegistry registry, String event) {
        return Counter.builder("pme.orders")
                .description("Commandes par étape de la saga")
                .tag("event", event)
                .register(registry);
    }

    public void orderPlaced() {
        afterCommit(placed::increment);
    }

    public void orderCompleted(OrderStatus status, Duration elapsed) {
        afterCommit(() -> {
            (status == OrderStatus.CONFIRMED ? confirmed : cancelled).increment();
            sagaDuration.record(elapsed.isNegative() ? Duration.ZERO : elapsed);
        });
    }

    private static void afterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
