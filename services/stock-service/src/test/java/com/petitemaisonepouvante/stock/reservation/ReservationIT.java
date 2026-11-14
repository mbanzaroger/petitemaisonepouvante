package com.petitemaisonepouvante.stock.reservation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.is;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.AnonymousQueue;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;

import com.petitemaisonepouvante.stock.AbstractIntegrationTest;
import com.petitemaisonepouvante.stock.messaging.Events;
import com.petitemaisonepouvante.stock.messaging.Messaging;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** US3 côté stock : réservation tout ou rien, idempotence, refus, file de rebut et accès ADMIN. */
class ReservationIT extends AbstractIntegrationTest {

    @Autowired
    private RabbitTemplate rabbit;

    @Autowired
    private AmqpAdmin admin;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private JsonMapper json;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ReservationService reservations;

    private Queue results;

    @BeforeEach
    void setUp() {
        results = new AnonymousQueue();
        admin.declareQueue(results);
        admin.declareBinding(BindingBuilder.bind(results).to(new TopicExchange(Messaging.EXCHANGE)).with("stock.*"));
    }

    @AfterEach
    void tearDown() {
        admin.deleteQueue(results.getName());
    }

    /** Produit dédié au test, pour ne pas dépendre de l'ordre d'exécution des autres tests. */
    private UUID newProduct(int available) {
        UUID id = UUID.randomUUID();
        jdbc.sql("insert into stock_item (product_id, available) values (:id, :available)")
                .param("id", id).param("available", available).update();
        return id;
    }

    private int available(UUID product) {
        return jdbc.sql("select available from stock_item where product_id = :id").param("id", product)
                .query(Integer.class).single();
    }

    private Events.OrderPlaced event(UUID orderId, Object... productAndQuantity) {
        List<Events.OrderPlaced.Line> lines = new ArrayList<>();
        for (int i = 0; i < productAndQuantity.length; i += 2) {
            lines.add(new Events.OrderPlaced.Line((UUID) productAndQuantity[i], (Integer) productAndQuantity[i + 1]));
        }
        return new Events.OrderPlaced(UUID.randomUUID(), "OrderPlaced", orderId, "it-stock", lines);
    }

    private void publish(Events.OrderPlaced event) {
        rabbit.send(Messaging.EXCHANGE, Messaging.ORDER_PLACED, MessageBuilder
                .withBody(json.writeValueAsString(event).getBytes(StandardCharsets.UTF_8))
                .setContentType(MessageProperties.CONTENT_TYPE_JSON)
                .setHeader(Messaging.CORRELATION_HEADER, "it-stock")
                .build());
    }

    private JsonNode awaitResult(UUID orderId) {
        Message message = rabbit.receive(results.getName(), 15_000);
        assertThat(message).as("résultat de réservation publié").isNotNull();
        JsonNode result = json.readTree(message.getBody());
        assertThat(result.get("orderId").asString()).isEqualTo(orderId.toString());
        assertThat(message.getMessageProperties().getHeaders()).containsEntry(Messaging.CORRELATION_HEADER, "it-stock");
        return result;
    }

    @Test
    @DisplayName("Étant donné un stock suffisant, OrderPlaced réserve le stock et publie StockReserved")
    void reservationReussie() {
        UUID product = newProduct(10);
        UUID order = UUID.randomUUID();
        publish(event(order, product, 3));

        assertThat(awaitResult(order).get("type").asString()).isEqualTo("StockReserved");
        assertThat(available(product)).isEqualTo(7);
        Map<String, Object> row = jdbc.sql("select reserved, version from stock_item where product_id = :id")
                .param("id", product).query().singleRow();
        assertThat(row).containsEntry("reserved", 3);
    }

    @Test
    @DisplayName("Un OrderPlaced rejoué (même eventId) ne décrémente le stock qu'une seule fois")
    void idempotence() {
        UUID product = newProduct(10);
        UUID order = UUID.randomUUID();
        Events.OrderPlaced event = event(order, product, 4);
        publish(event);
        awaitResult(order);
        publish(event);
        publish(event);

        assertThat(rabbit.receive(results.getName(), 3_000)).as("aucun second résultat").isNull();
        assertThat(available(product)).isEqualTo(6);
    }

    @Test
    @DisplayName("Étant donné un stock insuffisant, StockRejected est publié et le stock est inchangé")
    void stockInsuffisant() {
        UUID product = newProduct(2);
        UUID order = UUID.randomUUID();
        publish(event(order, product, 3));

        JsonNode result = awaitResult(order);
        assertThat(result.get("type").asString()).isEqualTo("StockRejected");
        assertThat(result.get("reason").asString()).contains("Stock insuffisant");
        assertThat(available(product)).isEqualTo(2);
    }

    @Test
    @DisplayName("Réservation tout ou rien : si une ligne échoue, aucune ligne n'est réservée")
    void toutOuRien() {
        UUID enStock = newProduct(5);
        UUID epuise = newProduct(0);
        UUID order = UUID.randomUUID();
        publish(event(order, enStock, 1, epuise, 1));

        assertThat(awaitResult(order).get("type").asString()).isEqualTo("StockRejected");
        assertThat(available(enStock)).isEqualTo(5);
    }

    @Test
    @DisplayName("Un produit sans stock référencé est refusé")
    void produitInconnu() {
        UUID order = UUID.randomUUID();
        publish(event(order, UUID.randomUUID(), 1));
        assertThat(awaitResult(order).get("reason").asString()).contains("sans stock");
    }

    @Test
    @DisplayName("Deux commandes simultanées sur la dernière unité : une seule est réservée (verrouillage)")
    void concurrence() throws Exception {
        UUID product = newProduct(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            Callable<ReservationService.Outcome> task = () -> reservations.reserve(event(UUID.randomUUID(), product, 1));
            Future<ReservationService.Outcome> first = pool.submit(task);
            Future<ReservationService.Outcome> second = pool.submit(task);
            assertThat(List.of(first.get(), second.get())).containsExactlyInAnyOrder(
                    ReservationService.Outcome.RESERVED, ReservationService.Outcome.REJECTED);
        } finally {
            pool.shutdownNow();
        }
        assertThat(available(product)).isZero();
    }

    @Test
    @DisplayName("Un message illisible part en file de rebut (DLQ)")
    void messageIllisibleEnDlq() {
        rabbit.send(Messaging.EXCHANGE, Messaging.ORDER_PLACED,
                MessageBuilder.withBody("{pas du json".getBytes(StandardCharsets.UTF_8)).build());
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                assertThat(rabbit.receive(Messaging.ORDER_PLACED_DLQ, 1_000)).isNotNull());
    }

    @Test
    @DisplayName("Le stock n'est consultable qu'avec le rôle ADMIN (401 sans jeton, 403 pour CUSTOMER)")
    void consultationReserveeAdmin() throws Exception {
        UUID product = newProduct(42);
        mvc.perform(get("/api/v1/stock/{id}", product)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/stock/{id}", product)
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/stock/{id}", product).with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.available", is(42)))
                .andExpect(jsonPath("$.reserved", is(0)));
        mvc.perform(get("/api/v1/stock/{id}", UUID.randomUUID())
                        .with(jwt().authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isNotFound());
    }
}
