package com.petitemaisonepouvante.order.api;

import java.util.Map;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.order.domain.OrderService;
import com.petitemaisonepouvante.order.domain.OrderStatus;

/**
 * US19 — suivi des commandes de tous les clients, réservé au rôle ADMIN (Gateway et SecurityConfig).
 * Lecture seule : l'état d'une commande n'évolue que par la saga.
 */
@RestController
@RequestMapping("/api/v1/orders/admin")
public class AdminOrderController {

    private final OrderService orders;

    public AdminOrderController(OrderService orders) {
        this.orders = orders;
    }

    @GetMapping
    public PageDto<AdminOrderDto> list(@RequestParam(required = false) OrderStatus status,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return PageDto.of(orders.listAll(status, page, size).stream().map(AdminOrderDto::from).toList(),
                page, size, orders.countAll(status));
    }

    /** Nombre de commandes par statut et chiffre d'affaires confirmé (centimes, EUR). */
    @GetMapping("/summary")
    public Summary summary() {
        var summary = orders.summary();
        return new Summary(summary.countsByStatus(), summary.confirmedRevenueCents(), "EUR");
    }

    public record Summary(Map<String, Long> countsByStatus, long confirmedRevenueCents, String currency) {
    }
}
