package com.petitemaisonepouvante.order.api;

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.petitemaisonepouvante.order.domain.Order;
import com.petitemaisonepouvante.order.domain.OrderService;

/**
 * US2 à US4 : réservé au rôle CUSTOMER. Le client est identifié par le « subject » du jeton,
 * jamais par un paramètre de la requête (pas d'accès à la commande d'autrui).
 */
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {

    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    /** 202 : la commande est acceptée et sera confirmée ou annulée de façon asynchrone par la saga. */
    @PostMapping
    public ResponseEntity<OrderDto> place(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PlaceOrderRequest request) {
        Order order = orders.placeOrder(jwt.getSubject(), jwt.getClaimAsString("preferred_username"), request);
        return ResponseEntity.accepted()
                .location(URI.create("/api/v1/orders/" + order.id()))
                .body(OrderDto.from(order));
    }

    @GetMapping
    public PageDto<OrderDto> mine(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        String customer = jwt.getSubject();
        return PageDto.of(orders.listForCustomer(customer, page, size).stream().map(OrderDto::from).toList(),
                page, size, orders.countForCustomer(customer));
    }

    /** La commande d'un autre client répond 404, comme une commande inexistante (pas d'énumération possible). */
    @GetMapping("/{id}")
    public OrderDto one(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return orders.findForCustomer(id, jwt.getSubject())
                .map(OrderDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commande introuvable"));
    }
}
