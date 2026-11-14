package com.petitemaisonepouvante.order.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.order.AbstractIntegrationTest;
import com.petitemaisonepouvante.order.catalog.CatalogClient;
import com.petitemaisonepouvante.order.catalog.CatalogProduct;
import com.petitemaisonepouvante.order.catalog.CatalogUnavailableException;
import com.petitemaisonepouvante.order.messaging.Messaging;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** US2, US3 (côté commande) et US4 : API sécurisée, saga et contrôle d'accès par propriétaire. */
class OrderApiIT extends AbstractIntegrationTest {

    private static final UUID FIGURINE = UUID.fromString("0f6c1a10-0001-4000-8000-000000000001");
    private static final UUID MUG = UUID.fromString("0f6c1a10-0008-4000-8000-000000000008");
    private static final UUID AFFICHE = UUID.fromString("0f6c1a10-0012-4000-8000-000000000012");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private RabbitTemplate rabbit;

    @Autowired
    private AmqpAdmin admin;

    @Autowired
    private JsonMapper json;

    @MockitoBean
    private CatalogClient catalog;

    private Queue published;

    @BeforeEach
    void setUp() {
        published = new AnonymousQueue();
        admin.declareQueue(published);
        admin.declareBinding(BindingBuilder.bind(published).to(new TopicExchange(Messaging.EXCHANGE))
                .with(Messaging.ORDER_PLACED));
        when(catalog.findByIds(any())).thenReturn(List.of(
                new CatalogProduct(FIGURINE, "Figurine L'Orc", new CatalogProduct.Price(5990, "EUR"), true),
                new CatalogProduct(MUG, "Mug", new CatalogProduct.Price(1290, "EUR"), true),
                new CatalogProduct(AFFICHE, "Affiche épuisée", new CatalogProduct.Price(2990, "EUR"), false)));
    }

    @AfterEach
    void tearDown() {
        admin.deleteQueue(published.getName());
    }

    private static RequestPostProcessor customer(String subject) {
        return jwt().jwt(token -> token.subject(subject)).authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"));
    }

    private static String body(Object... productAndQuantity) {
        StringBuilder lines = new StringBuilder();
        for (int i = 0; i < productAndQuantity.length; i += 2) {
            if (i > 0) {
                lines.append(',');
            }
            lines.append("{\"productId\":\"").append(productAndQuantity[i]).append("\",\"quantity\":")
                    .append(productAndQuantity[i + 1]).append('}');
        }
        return "{\"lines\":[" + lines + "]}";
    }

    private String placeOrder(String subject, String requestBody) throws Exception {
        String response = mvc.perform(post("/api/v1/orders").with(customer(subject))
                        .contentType(MediaType.APPLICATION_JSON).content(requestBody))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(response).get("id").asString();
    }

    private void publishStockResult(String type, String orderId, String routingKey) {
        String payload = json.writeValueAsString(Map.of(
                "eventId", UUID.randomUUID().toString(), "type", type, "orderId", orderId, "reason", "test"));
        rabbit.send(Messaging.EXCHANGE, routingKey, MessageBuilder.withBody(payload.getBytes(StandardCharsets.UTF_8))
                .setContentType(MessageProperties.CONTENT_TYPE_JSON).build());
    }

    private void awaitStatus(String subject, String orderId, String expected) {
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                mvc.perform(get("/api/v1/orders/{id}", orderId).with(customer(subject)))
                        .andExpect(jsonPath("$.status", is(expected))));
    }

    @Test
    @DisplayName("US2 — Étant donné aucun jeton, quand j'appelle POST /api/v1/orders, alors je reçois 401")
    void sansJeton() throws Exception {
        mvc.perform(post("/api/v1/orders").contentType(MediaType.APPLICATION_JSON).content(body(FIGURINE, 1)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("US2 — Un jeton valide sans le rôle CUSTOMER est refusé (403)")
    void sansRoleCustomer() throws Exception {
        mvc.perform(post("/api/v1/orders").with(jwt()).contentType(MediaType.APPLICATION_JSON).content(body(FIGURINE, 1)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("US3 — Une commande valide est acceptée (202) en PENDING et publie OrderPlaced avec le correlationId")
    void commandeAccepteeEtEvenementPublie() throws Exception {
        String subject = UUID.randomUUID().toString();
        String response = mvc.perform(post("/api/v1/orders").with(customer(subject))
                        .header("X-Correlation-Id", "it-commande-1")
                        .contentType(MediaType.APPLICATION_JSON).content(body(FIGURINE, 2, MUG, 1)))
                .andExpect(status().isAccepted())
                .andExpect(header().string("Location", startsWith("/api/v1/orders/")))
                .andExpect(jsonPath("$.status", is("PENDING")))
                .andExpect(jsonPath("$.totalCents", is(2 * 5990 + 1290)))
                .andExpect(jsonPath("$.lines", hasSize(2)))
                .andExpect(jsonPath("$.lines[0].unitPriceCents", is(5990)))
                .andReturn().getResponse().getContentAsString();
        String orderId = json.readTree(response).get("id").asString();

        Message message = rabbit.receive(published.getName(), 15_000);
        assertThat(message).as("OrderPlaced publié par la boîte d'envoi").isNotNull();
        JsonNode event = json.readTree(message.getBody());
        assertThat(event.get("orderId").asString()).isEqualTo(orderId);
        assertThat(event.get("type").asString()).isEqualTo("OrderPlaced");
        assertThat(event.get("lines")).hasSize(2);
        assertThat(message.getMessageProperties().getMessageId()).isEqualTo(event.get("eventId").asString());
        assertThat(message.getMessageProperties().getHeaders()).containsEntry(Messaging.CORRELATION_HEADER, "it-commande-1");
    }

    @Test
    @DisplayName("Sécurité — un prix envoyé par le client est ignoré : le total est calculé avec le prix du catalogue")
    void prixClientIgnore() throws Exception {
        String tampered = "{\"lines\":[{\"productId\":\"" + FIGURINE + "\",\"quantity\":1,\"unitPriceCents\":1}],"
                + "\"totalCents\":1}";
        mvc.perform(post("/api/v1/orders").with(customer(UUID.randomUUID().toString()))
                        .contentType(MediaType.APPLICATION_JSON).content(tampered))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.totalCents", is(5990)));
    }

    @Test
    @DisplayName("US3 — Étant donné un stock suffisant, la commande passe de PENDING à CONFIRMED")
    void sagaConfirmee() throws Exception {
        String subject = UUID.randomUUID().toString();
        String orderId = placeOrder(subject, body(MUG, 3));
        publishStockResult("StockReserved", orderId, Messaging.STOCK_RESERVED);
        awaitStatus(subject, orderId, "CONFIRMED");
    }

    @Test
    @DisplayName("US3 — Étant donné un stock insuffisant, la commande passe à CANCELLED ; un événement tardif ne la modifie plus")
    void sagaAnnuleeEtIdempotente() throws Exception {
        String subject = UUID.randomUUID().toString();
        String orderId = placeOrder(subject, body(FIGURINE, 1));
        publishStockResult("StockRejected", orderId, Messaging.STOCK_REJECTED);
        awaitStatus(subject, orderId, "CANCELLED");

        publishStockResult("StockReserved", orderId, Messaging.STOCK_RESERVED);
        Thread.sleep(1500);
        mvc.perform(get("/api/v1/orders/{id}", orderId).with(customer(subject)))
                .andExpect(jsonPath("$.status", is("CANCELLED")));
    }

    @Test
    @DisplayName("Un produit indisponible ou inconnu rend la commande impossible (422)")
    void produitIndisponible() throws Exception {
        mvc.perform(post("/api/v1/orders").with(customer(UUID.randomUUID().toString()))
                        .contentType(MediaType.APPLICATION_JSON).content(body(AFFICHE, 1)))
                .andExpect(status().is(422))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON));
        mvc.perform(post("/api/v1/orders").with(customer(UUID.randomUUID().toString()))
                        .contentType(MediaType.APPLICATION_JSON).content(body(UUID.randomUUID(), 1)))
                .andExpect(status().is(422));
    }

    @Test
    @DisplayName("Un catalogue indisponible donne 503, sans créer de commande")
    void catalogueIndisponible() throws Exception {
        when(catalog.findByIds(any())).thenThrow(new CatalogUnavailableException(new RuntimeException("timeout")));
        String subject = UUID.randomUUID().toString();
        mvc.perform(post("/api/v1/orders").with(customer(subject))
                        .contentType(MediaType.APPLICATION_JSON).content(body(FIGURINE, 1)))
                .andExpect(status().isServiceUnavailable());
        mvc.perform(get("/api/v1/orders").with(customer(subject))).andExpect(jsonPath("$.totalElements", is(0)));
    }

    @Test
    @DisplayName("Les demandes mal formées sont refusées (400) ; un produit en double est refusé (422)")
    void validation() throws Exception {
        String subject = UUID.randomUUID().toString();
        mvc.perform(post("/api/v1/orders").with(customer(subject)).contentType(MediaType.APPLICATION_JSON)
                .content("{\"lines\":[]}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/orders").with(customer(subject)).contentType(MediaType.APPLICATION_JSON)
                .content(body(FIGURINE, 0))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/orders").with(customer(subject)).contentType(MediaType.APPLICATION_JSON)
                .content(body(FIGURINE, 11))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/orders").with(customer(subject)).contentType(MediaType.APPLICATION_JSON)
                .content("{pas du json")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/orders").with(customer(subject)).contentType(MediaType.APPLICATION_JSON)
                .content(body(FIGURINE, 1, FIGURINE, 2))).andExpect(status().is(422));
    }

    @Test
    @DisplayName("US4 — Étant donné deux clients, chacun ne voit que ses commandes ; celle de l'autre répond 404")
    void historiqueParProprietaire() throws Exception {
        String alice = UUID.randomUUID().toString();
        String bob = UUID.randomUUID().toString();
        String commandeAlice = placeOrder(alice, body(MUG, 1));
        placeOrder(alice, body(FIGURINE, 1));
        placeOrder(bob, body(MUG, 2));

        mvc.perform(get("/api/v1/orders").with(customer(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements", is(2)))
                .andExpect(jsonPath("$.content", hasSize(2)));
        mvc.perform(get("/api/v1/orders").with(customer(bob)))
                .andExpect(jsonPath("$.totalElements", is(1)));
        mvc.perform(get("/api/v1/orders/{id}", commandeAlice).with(customer(bob)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/orders/{id}", commandeAlice).with(customer(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines[0].productName", is("Mug")));
    }

    @Test
    @DisplayName("Un résultat de stock illisible part en file de rebut (DLQ) au lieu de bloquer la file")
    void messageIllisibleEnDlq() {
        rabbit.send(Messaging.EXCHANGE, Messaging.STOCK_RESERVED,
                MessageBuilder.withBody("pas du json".getBytes(StandardCharsets.UTF_8)).build());
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() ->
                assertThat(rabbit.receive(Messaging.STOCK_RESULT_DLQ, 1_000)).isNotNull());
    }
}
