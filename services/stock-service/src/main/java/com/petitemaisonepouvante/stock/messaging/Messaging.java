package com.petitemaisonepouvante.stock.messaging;

import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Declarables;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Topologie RabbitMQ de la saga (docs/03-saga-commande.md, validée par l'expérimentation E3).
 * order-service et stock-service déclarent la même topologie complète : quel que soit l'ordre de démarrage,
 * les files existent avant la première publication et aucun événement n'est perdu faute de destinataire.
 * Files quorum (répliquées), file de rebut pour les messages illisibles ou en échec répété.
 */
@Configuration
public class Messaging {

    public static final String EXCHANGE = "orders";
    public static final String DEAD_LETTER_EXCHANGE = "orders.dlx";
    public static final String ORDER_PLACED = "order.placed";
    public static final String STOCK_RESERVED = "stock.reserved";
    public static final String STOCK_REJECTED = "stock.rejected";
    public static final String ORDER_PLACED_QUEUE = "stock.order-placed";
    public static final String STOCK_RESULT_QUEUE = "order.stock-result";
    public static final String STOCK_RESULT_DLQ = "order.stock-result.dlq";
    public static final String ORDER_PLACED_DLQ = "stock.order-placed.dlq";
    public static final String CORRELATION_HEADER = "x-correlation-id";

    @Bean
    Declarables sagaTopology() {
        TopicExchange exchange = new TopicExchange(EXCHANGE, true, false);
        DirectExchange deadLetters = new DirectExchange(DEAD_LETTER_EXCHANGE, true, false);
        Queue orderPlaced = quorumWithDeadLetters(ORDER_PLACED_QUEUE, ORDER_PLACED_DLQ);
        Queue stockResult = quorumWithDeadLetters(STOCK_RESULT_QUEUE, STOCK_RESULT_DLQ);
        Queue orderPlacedDlq = QueueBuilder.durable(ORDER_PLACED_DLQ).quorum().build();
        Queue stockResultDlq = QueueBuilder.durable(STOCK_RESULT_DLQ).quorum().build();
        // Chaque file principale envoie ses rebuts vers sa propre DLQ (clé de routage = nom de la DLQ).
        return new Declarables(exchange, deadLetters, orderPlaced, stockResult, orderPlacedDlq, stockResultDlq,
                BindingBuilder.bind(orderPlaced).to(exchange).with(ORDER_PLACED),
                BindingBuilder.bind(stockResult).to(exchange).with(STOCK_RESERVED),
                BindingBuilder.bind(stockResult).to(exchange).with(STOCK_REJECTED),
                BindingBuilder.bind(orderPlacedDlq).to(deadLetters).with(ORDER_PLACED_DLQ),
                BindingBuilder.bind(stockResultDlq).to(deadLetters).with(STOCK_RESULT_DLQ));
    }

    private static Queue quorumWithDeadLetters(String name, String deadLetterQueue) {
        return QueueBuilder.durable(name).quorum()
                .deadLetterExchange(DEAD_LETTER_EXCHANGE)
                .deadLetterRoutingKey(deadLetterQueue)
                .deliveryLimit(5)
                .build();
    }
}
