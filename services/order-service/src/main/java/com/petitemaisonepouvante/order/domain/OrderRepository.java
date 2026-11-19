package com.petitemaisonepouvante.order.domain;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Persistance des commandes, requêtes SQL paramétrées uniquement. */
@Repository
public class OrderRepository {

    private static final String SELECT_ORDER =
            "select id, customer_id, customer_name, status, total_cents, currency, created_at, updated_at from customer_order";

    private final JdbcClient jdbc;

    public OrderRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void insert(Order order) {
        jdbc.sql("""
                insert into customer_order (id, customer_id, customer_name, status, total_cents, currency)
                values (:id, :customer, :customerName, :status, :total, :currency)
                """)
                .param("id", order.id())
                .param("customer", order.customerId())
                .param("customerName", order.customerName())
                .param("status", order.status().name())
                .param("total", order.totalCents())
                .param("currency", order.currency())
                .update();
        for (OrderLine line : order.lines()) {
            jdbc.sql("""
                    insert into order_line (order_id, line_no, product_id, product_name, quantity, unit_price_cents)
                    values (:order, :lineNo, :product, :name, :quantity, :price)
                    """)
                    .param("order", order.id())
                    .param("lineNo", line.lineNo())
                    .param("product", line.productId())
                    .param("name", line.productName())
                    .param("quantity", line.quantity())
                    .param("price", line.unitPriceCents())
                    .update();
        }
    }

    public Optional<Order> findByIdAndCustomer(UUID id, String customerId) {
        return jdbc.sql(SELECT_ORDER + " where id = :id and customer_id = :customer")
                .param("id", id)
                .param("customer", customerId)
                .query(OrderRepository::mapOrder)
                .optional()
                .map(order -> withLines(List.of(order)).get(0));
    }

    public Optional<Order> findById(UUID id) {
        return jdbc.sql(SELECT_ORDER + " where id = :id").param("id", id)
                .query(OrderRepository::mapOrder).optional()
                .map(order -> withLines(List.of(order)).get(0));
    }

    public List<Order> findByCustomer(String customerId, int page, int size) {
        List<Order> orders = jdbc.sql(SELECT_ORDER
                        + " where customer_id = :customer order by created_at desc, id limit :limit offset :offset")
                .param("customer", customerId)
                .param("limit", size)
                .param("offset", (long) page * size)
                .query(OrderRepository::mapOrder)
                .list();
        return withLines(orders);
    }

    public long countByCustomer(String customerId) {
        return jdbc.sql("select count(*) from customer_order where customer_id = :customer")
                .param("customer", customerId).query(Long.class).single();
    }

    /** US19 — toutes les commandes, les plus récentes d'abord, éventuellement filtrées par statut. */
    public List<Order> findAll(OrderStatus status, int page, int size) {
        String where = status == null ? "" : " where status = :status";
        JdbcClient.StatementSpec statement = jdbc.sql(SELECT_ORDER + where
                        + " order by created_at desc, id limit :limit offset :offset")
                .param("limit", size)
                .param("offset", (long) page * size);
        if (status != null) {
            statement = statement.param("status", status.name());
        }
        return withLines(statement.query(OrderRepository::mapOrder).list());
    }

    public long countAll(OrderStatus status) {
        if (status == null) {
            return jdbc.sql("select count(*) from customer_order").query(Long.class).single();
        }
        return jdbc.sql("select count(*) from customer_order where status = :status").param("status", status.name())
                .query(Long.class).single();
    }

    /** Nombre de commandes par statut et chiffre d'affaires des commandes confirmées (en centimes). */
    public Summary summary() {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (OrderStatus status : OrderStatus.values()) {
            counts.put(status.name(), 0L);
        }
        jdbc.sql("select status, count(*) as n from customer_order group by status")
                .query((rs, row) -> counts.put(rs.getString("status"), rs.getLong("n")))
                .list();
        long revenue = jdbc.sql("select coalesce(sum(total_cents), 0) from customer_order where status = 'CONFIRMED'")
                .query(Long.class).single();
        return new Summary(counts, revenue);
    }

    public record Summary(Map<String, Long> countsByStatus, long confirmedRevenueCents) {
    }

    /**
     * Transition idempotente : seule une commande encore PENDING change d'état.
     * Un événement rejoué ou en retard ne modifie donc jamais une commande déjà finalisée.
     *
     * @return l'instant de création de la commande si la transition a eu lieu (mesure de la durée de saga), vide sinon
     */
    public Optional<Instant> completeIfPending(UUID id, OrderStatus status) {
        return jdbc.sql("""
                update customer_order set status = :status, updated_at = now()
                where id = :id and status = 'PENDING'
                returning created_at
                """)
                .param("status", status.name())
                .param("id", id)
                .query((rs, row) -> rs.getObject("created_at", OffsetDateTime.class).toInstant())
                .optional();
    }

    private List<Order> withLines(List<Order> orders) {
        if (orders.isEmpty()) {
            return orders;
        }
        Map<UUID, List<OrderLine>> lines = new LinkedHashMap<>();
        orders.forEach(order -> lines.put(order.id(), new ArrayList<>()));
        jdbc.sql("""
                select order_id, line_no, product_id, product_name, quantity, unit_price_cents
                from order_line where order_id in (:ids) order by order_id, line_no
                """)
                .param("ids", lines.keySet())
                .query((rs, row) -> {
                    lines.get(rs.getObject("order_id", UUID.class)).add(new OrderLine(
                            rs.getInt("line_no"),
                            rs.getObject("product_id", UUID.class),
                            rs.getString("product_name"),
                            rs.getInt("quantity"),
                            rs.getInt("unit_price_cents")));
                    return null;
                })
                .list();
        return orders.stream()
                .map(o -> new Order(o.id(), o.customerId(), o.customerName(), o.status(), o.totalCents(), o.currency(),
                        o.createdAt(), o.updatedAt(), List.copyOf(lines.get(o.id()))))
                .toList();
    }

    private static Order mapOrder(ResultSet rs, int row) throws SQLException {
        return new Order(
                rs.getObject("id", UUID.class),
                rs.getString("customer_id"),
                rs.getString("customer_name"),
                OrderStatus.valueOf(rs.getString("status")),
                rs.getInt("total_cents"),
                rs.getString("currency").trim(),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class),
                List.of());
    }
}
