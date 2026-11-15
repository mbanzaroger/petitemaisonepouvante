package com.petitemaisonepouvante.order.messaging;

import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.order.web.CorrelationIdFilter;

/**
 * Publie les événements de la boîte d'envoi avec confirmation du broker (publisher confirms).
 * Un événement n'est marqué publié qu'après l'accusé de RabbitMQ : livraison « au moins une fois »,
 * les consommateurs sont idempotents. Le correlationId de l'événement est replacé dans le MDC pendant
 * la publication (US5) : le log de publication se rattache à la requête d'origine.
 */
@Component
public class OutboxPublisher {

    private static final Logger LOG = LoggerFactory.getLogger(OutboxPublisher.class);
    private static final long CONFIRM_TIMEOUT_MS = 5_000;

    private final OutboxRepository outbox;
    private final RabbitTemplate rabbit;

    public OutboxPublisher(OutboxRepository outbox, RabbitTemplate rabbit) {
        this.outbox = outbox;
        this.rabbit = rabbit;
    }

    @Scheduled(fixedDelayString = "${pme.outbox.delay-ms:500}")
    @Transactional
    public void publishPending() {
        for (OutboxEvent event : outbox.lockPending(50)) {
            if (event.correlationId() != null) {
                MDC.put(CorrelationIdFilter.MDC_KEY, event.correlationId());
            }
            try {
                publish(event);
            } finally {
                MDC.remove(CorrelationIdFilter.MDC_KEY);
            }
        }
    }

    private void publish(OutboxEvent event) {
        Message message = MessageBuilder.withBody(event.payload().getBytes(StandardCharsets.UTF_8))
                .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                .setContentEncoding("UTF-8")
                .setMessageId(event.id().toString())
                .setDeliveryMode(MessageDeliveryMode.PERSISTENT)
                .setHeader(Messaging.CORRELATION_HEADER, event.correlationId())
                .build();
        rabbit.invoke(operations -> {
            operations.send(Messaging.EXCHANGE, event.routingKey(), message);
            operations.waitForConfirmsOrDie(CONFIRM_TIMEOUT_MS);
            return null;
        });
        outbox.markPublished(event.id());
        LOG.info("Événement {} publié ({})", event.id(), event.routingKey());
    }
}
