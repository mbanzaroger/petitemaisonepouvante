package com.petitemaisonepouvante.stock.reservation;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Stock et réservations ; requêtes SQL paramétrées, verrouillage pessimiste des lignes réservées. */
@Repository
public class StockRepository {

    private final JdbcClient jdbc;

    public StockRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Enregistre l'événement comme traité ; renvoie false s'il l'était déjà (rejeu ou doublon). */
    public boolean markProcessed(UUID eventId) {
        return jdbc.sql("insert into processed_event (event_id) values (:id) on conflict (event_id) do nothing")
                .param("id", eventId)
                .update() == 1;
    }

    /**
     * Verrouille les lignes de stock concernées, toujours dans le même ordre (identifiant croissant)
     * pour éviter les interblocages entre deux commandes portant sur les mêmes produits.
     */
    public Map<UUID, Integer> lockAvailable(Collection<UUID> productIds) {
        Map<UUID, Integer> available = new HashMap<>();
        jdbc.sql("""
                select product_id, available from stock_item
                where product_id in (:ids) order by product_id for update
                """)
                .param("ids", productIds)
                .query((rs, row) -> available.put(rs.getObject("product_id", UUID.class), rs.getInt("available")))
                .list();
        return available;
    }

    public void reserve(UUID orderId, UUID productId, int quantity) {
        jdbc.sql("""
                update stock_item set available = available - :quantity, reserved = reserved + :quantity,
                       version = version + 1
                where product_id = :product
                """)
                .param("quantity", quantity)
                .param("product", productId)
                .update();
        jdbc.sql("insert into stock_reservation (order_id, product_id, quantity) values (:order, :product, :quantity)")
                .param("order", orderId)
                .param("product", productId)
                .param("quantity", quantity)
                .update();
    }

    public Optional<StockLevel> find(UUID productId) {
        return jdbc.sql("select product_id, available, reserved from stock_item where product_id = :id")
                .param("id", productId)
                .query((rs, row) -> new StockLevel(rs.getObject("product_id", UUID.class), rs.getInt("available"),
                        rs.getInt("reserved")))
                .optional();
    }

    public record StockLevel(UUID productId, int available, int reserved) {
    }
}
