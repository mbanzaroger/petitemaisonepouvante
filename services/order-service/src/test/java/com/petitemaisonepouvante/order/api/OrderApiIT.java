package com.petitemaisonepouvante.order.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
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

import io.micrometer.core.instrument.MeterRegistry;
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

    @Autowired
    private MeterRegistry meters;

    @MockitoBean
    private CatalogClient catalog;

    private Queue published;

    @BeforeEach
    void setUp() {
        // File de test durable, non exclusive et non auto-supprimée (RabbitMQ 4 refuse les files transitoires
        // non exclusives) : plusieurs lectures successives sont possibles ; supprimée après le test.
        published = new Queue("test." + UUID.randomUUID(), true, false, false);
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

    private static RequestPostProcessor named(String subject, String name) {
        return jwt().jwt(token -> token.subject(subject).claim("preferred_username", name))
                .authorities(new SimpleGrantedAuthority("ROLE_CUSTOMER"));
    }

    private static RequestPostProcessor administrator() {
        return jwt().jwt(token -> token.subject(UUID.randomUUID().toString()).claim("preferred_username", "admin-pme"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private String placeOrder(String subject, String requestBody) throws Exception {
        return placeOrderAs(customer(subject), requestBody);
    }

    private String placeOrderAs(RequestPostProcessor who, String requestBody) throws Exception {
        String response = mvc.perform(post("/api/v1/orders").with(who)
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

        // D'autres commandes des tests précédents peuvent être publiées dans la même fenêtre : on cherche la nôtre.
        Message message = null;
        JsonNode event = null;
        long deadline = System.currentTimeMillis() + 15_000;
        while (System.currentTimeMillis() < deadline) {
            Message candidate = rabbit.receive(published.getName(), 1_000);
            if (candidate != null && orderId.equals(json.readTree(candidate.getBody()).get("orderId").asString())) {
                message = candidate;
                event = json.readTree(candidate.getBody());
                break;
            }
        }
        assertThat(message).as("OrderPlaced publié par la boîte d'envoi").isNotNull();
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
    @DisplayName("US5 — Les métriques métier suivent la saga : commande créée, confirmée et durée mesurée")
    void metriquesDeSaga() throws Exception {
        double placedBefore = orderCount("placed");
        double confirmedBefore = orderCount("confirmed");
        long durationsBefore = meters.get("pme.saga.duration").timer().count();

        String subject = UUID.randomUUID().toString();
        String orderId = placeOrder(subject, body(MUG, 1));
        assertThat(orderCount("placed")).as("comptée après validation de la transaction").isEqualTo(placedBefore + 1);

        publishStockResult("StockReserved", orderId, Messaging.STOCK_RESERVED);
        awaitStatus(subject, orderId, "CONFIRMED");
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            assertThat(orderCount("confirmed")).isGreaterThanOrEqualTo(confirmedBefore + 1);
            assertThat(meters.get("pme.saga.duration").timer().count()).isGreaterThan(durationsBefore);
        });
    }

    private double orderCount(String event) {
        return meters.get("pme.orders").tag("event", event).counter().count();
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

    @Test
    @DisplayName("US19 — L'administrateur suit les commandes de tous les clients, par statut, avec le nom du client")
    void suiviAdministrateur() throws Exception {
        String nom = "client-" + UUID.randomUUID().toString().substring(0, 8);
        String subject = UUID.randomUUID().toString();
        String confirmee = placeOrderAs(named(subject, nom), body(MUG, 2));
        String enAttente = placeOrderAs(named(subject, nom), body(FIGURINE, 1));
        publishStockResult("StockReserved", confirmee, Messaging.STOCK_RESERVED);
        awaitStatus(subject, confirmee, "CONFIRMED");

        mvc.perform(get("/api/v1/orders/admin").param("size", "100").with(administrator()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.customerName == '" + nom + "')]", hasSize(2)))
                .andExpect(jsonPath("$.content[0].customerId").doesNotExist());
        mvc.perform(get("/api/v1/orders/admin").param("status", "CONFIRMED").param("size", "100")
                        .with(administrator()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[?(@.id == '" + confirmee + "')].customerName", contains(nom)))
                .andExpect(jsonPath("$.content[?(@.id == '" + confirmee + "')].lines[0].productName", contains("Mug")))
                .andExpect(jsonPath("$.content[?(@.id == '" + enAttente + "')]", hasSize(0)));
        mvc.perform(get("/api/v1/orders/admin/summary").with(administrator()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.countsByStatus.CONFIRMED", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.countsByStatus.PENDING", greaterThanOrEqualTo(1)))
                .andExpect(jsonPath("$.confirmedRevenueCents", greaterThanOrEqualTo(2580)))
                .andExpect(jsonPath("$.currency", is("EUR")));
    }

    @Test
    @DisplayName("US19 — Le suivi des commandes est refusé à un client (403) et à un visiteur (401) ; statut inconnu : 400")
    void suiviReserveAdministrateur() throws Exception {
        String client = UUID.randomUUID().toString();
        mvc.perform(get("/api/v1/orders/admin").with(customer(client))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/orders/admin/summary").with(customer(client))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/orders/admin")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/orders/admin").param("status", "INCONNU").with(administrator()))
                .andExpect(status().isBadRequest());
    }
}
