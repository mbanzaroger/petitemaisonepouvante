package com.petitemaisonepouvante.order.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.order.api.PlaceOrderRequest;
import com.petitemaisonepouvante.order.catalog.CatalogClient;
import com.petitemaisonepouvante.order.catalog.CatalogProduct;
import com.petitemaisonepouvante.order.messaging.Events;
import com.petitemaisonepouvante.order.messaging.Messaging;
import com.petitemaisonepouvante.order.messaging.OutboxEvent;
import com.petitemaisonepouvante.order.messaging.OutboxRepository;
import com.petitemaisonepouvante.order.observability.SagaMetrics;
import com.petitemaisonepouvante.order.web.CorrelationIdFilter;

import tools.jackson.databind.json.JsonMapper;

/** US3 et US4 : création des commandes (début de la saga), consultation par le propriétaire, finalisation. */
@Service
public class OrderService {

    private static final Logger LOG = LoggerFactory.getLogger(OrderService.class);

    private final OrderRepository orders;
    private final OutboxRepository outbox;
    private final CatalogClient catalog;
    private final JsonMapper json;
    private final SagaMetrics metrics;

    public OrderService(OrderRepository orders, OutboxRepository outbox, CatalogClient catalog, JsonMapper json,
            SagaMetrics metrics) {
        this.orders = orders;
        this.outbox = outbox;
        this.catalog = catalog;
        this.json = json;
        this.metrics = metrics;
    }

    /**
     * Crée la commande en PENDING et écrit l'événement OrderPlaced dans la même transaction.
     * Le prix de chaque ligne est relu dans le catalogue : un prix fourni par le client serait ignoré (STRIDE : Tampering).
     */
    @Transactional
    public Order placeOrder(String customerId, PlaceOrderRequest request) {
        Set<UUID> distinct = new HashSet<>();
        for (PlaceOrderRequest.Line line : request.lines()) {
            if (!distinct.add(line.productId())) {
                throw new OrderRejectedException("Un même produit apparaît sur plusieurs lignes ; regroupez les quantités.");
            }
        }
        Map<UUID, CatalogProduct> products = catalog.findByIds(distinct).stream()
                .collect(Collectors.toMap(CatalogProduct::id, Function.identity(), (a, b) -> a));

        List<OrderLine> lines = new ArrayList<>();
        String currency = null;
        int lineNo = 1;
        for (PlaceOrderRequest.Line requested : request.lines()) {
            CatalogProduct product = products.get(requested.productId());
            if (product == null || !product.available()) {
                throw new OrderRejectedException("Produit inconnu ou indisponible : " + requested.productId());
            }
            if (currency != null && !currency.equals(product.price().currency())) {
                throw new OrderRejectedException("Une commande ne peut mélanger plusieurs devises.");
            }
            currency = product.price().currency();
            lines.add(new OrderLine(lineNo++, product.id(), product.name(), requested.quantity(),
                    product.price().amountCents()));
        }

        Order order = new Order(UUID.randomUUID(), customerId, OrderStatus.PENDING, Order.total(lines), currency,
                null, null, List.copyOf(lines));
        orders.insert(order);

        UUID eventId = UUID.randomUUID();
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        Events.OrderPlaced event = Events.OrderPlaced.of(eventId, correlationId, order.id(), customerId,
                lines.stream().map(l -> new Events.OrderPlaced.Line(l.productId(), l.quantity())).toList());
        outbox.add(new OutboxEvent(eventId, Messaging.ORDER_PLACED, json.writeValueAsString(event), correlationId));
        // Traçabilité (STRIDE, répudiation) : l'identifiant client est le « subject » Keycloak, pseudonyme.
        LOG.info("Commande {} créée pour le client {} ({} ligne(s), total {} centimes)", order.id(), customerId,
                lines.size(), order.totalCents());
        metrics.orderPlaced();
        return orders.findById(order.id()).orElseThrow();
    }

    @Transactional(readOnly = true)
    public Optional<Order> findForCustomer(UUID orderId, String customerId) {
        return orders.findByIdAndCustomer(orderId, customerId);
    }

    @Transactional(readOnly = true)
    public List<Order> listForCustomer(String customerId, int page, int size) {
        return orders.findByCustomer(customerId, page, size);
    }

    @Transactional(readOnly = true)
    public long countForCustomer(String customerId) {
        return orders.countByCustomer(customerId);
    }

    /** Étape finale de la saga ; idempotente grâce à la transition conditionnelle PENDING → état final. */
    @Transactional
    public boolean applyStockResult(Events.StockResult result) {
        OrderStatus target = result.reserved() ? OrderStatus.CONFIRMED : OrderStatus.CANCELLED;
        Optional<Instant> createdAt = orders.completeIfPending(result.orderId(), target);
        createdAt.ifPresent(created -> {
            metrics.orderCompleted(target, Duration.between(created, Instant.now()));
            if (!result.reserved()) {
                LOG.info("Commande {} annulée : {}", result.orderId(), result.reason());
            }
        });
        return createdAt.isPresent();
    }
}
