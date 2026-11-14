package com.petitemaisonepouvante.order.messaging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import com.petitemaisonepouvante.order.domain.OrderService;
import com.petitemaisonepouvante.order.web.CorrelationIdFilter;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/** Reçoit le résultat de la réservation de stock et finalise la commande (étape 3 de la saga). */
@Component
public class StockResultListener {

    private static final Logger LOG = LoggerFactory.getLogger(StockResultListener.class);

    private final OrderService orders;
    private final JsonMapper json;

    public StockResultListener(OrderService orders, JsonMapper json) {
        this.orders = orders;
        this.json = json;
    }

    @RabbitListener(queues = Messaging.STOCK_RESULT_QUEUE)
    public void onStockResult(Message message) {
        Object correlationId = message.getMessageProperties().getHeaders().get(Messaging.CORRELATION_HEADER);
        if (correlationId != null) {
            MDC.put(CorrelationIdFilter.MDC_KEY, correlationId.toString());
        }
        try {
            Events.StockResult result = parse(message.getBody());
            boolean changed = orders.applyStockResult(result);
            LOG.info("Résultat de stock {} pour la commande {} : {}", result.type(), result.orderId(),
                    changed ? "commande finalisée" : "ignoré (déjà finalisée)");
        } finally {
            MDC.remove(CorrelationIdFilter.MDC_KEY);
        }
    }

    Events.StockResult parse(byte[] body) {
        try {
            Events.StockResult result = json.readValue(body, Events.StockResult.class);
            if (!result.valid()) {
                throw new AmqpRejectAndDontRequeueException("Événement de stock incomplet");
            }
            return result;
        } catch (JacksonException e) {
            // Message illisible : jamais remis en file, il part directement en file de rebut.
            throw new AmqpRejectAndDontRequeueException("Événement de stock illisible", e);
        }
    }
}
