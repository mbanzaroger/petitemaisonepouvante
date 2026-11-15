package com.petitemaisonepouvante.stock.messaging;

import org.slf4j.MDC;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import com.petitemaisonepouvante.stock.observability.ReservationMetrics;
import com.petitemaisonepouvante.stock.reservation.ReservationService;
import com.petitemaisonepouvante.stock.web.CorrelationIdFilter;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** Consomme OrderPlaced (étape 2 de la saga). Accusé de réception après validation de la transaction. */
@Component
public class OrderPlacedListener {

    private final ReservationService reservations;
    private final ReservationMetrics metrics;
    private final JsonMapper json;

    public OrderPlacedListener(ReservationService reservations, ReservationMetrics metrics, JsonMapper json) {
        this.reservations = reservations;
        this.metrics = metrics;
        this.json = json;
    }

    @RabbitListener(queues = Messaging.ORDER_PLACED_QUEUE)
    public void onOrderPlaced(Message message) {
        Object correlationId = message.getMessageProperties().getHeaders().get(Messaging.CORRELATION_HEADER);
        if (correlationId != null) {
            MDC.put(CorrelationIdFilter.MDC_KEY, correlationId.toString());
        }
        try {
            metrics.record(reservations.reserve(parse(message.getBody())));
        } finally {
            MDC.remove(CorrelationIdFilter.MDC_KEY);
        }
    }

    Events.OrderPlaced parse(byte[] body) {
        try {
            Events.OrderPlaced event = json.readValue(body, Events.OrderPlaced.class);
            if (event.eventId() == null || event.orderId() == null) {
                throw new AmqpRejectAndDontRequeueException("Événement OrderPlaced sans identifiant");
            }
            return event;
        } catch (JacksonException e) {
            // Message illisible : rejeté sans remise en file, routé vers la DLQ (leçon de l'expérimentation E3).
            throw new AmqpRejectAndDontRequeueException("Événement OrderPlaced illisible", e);
        }
    }
}
