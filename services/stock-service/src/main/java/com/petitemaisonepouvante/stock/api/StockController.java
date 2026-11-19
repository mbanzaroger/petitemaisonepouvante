package com.petitemaisonepouvante.stock.api;

import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.petitemaisonepouvante.stock.observability.ReservationMetrics;
import com.petitemaisonepouvante.stock.reservation.StockRepository;

/**
 * Stock d'un produit, réservé au rôle ADMIN : consultation (supervision et démonstration de la saga),
 * réapprovisionnement et correction d'inventaire (US18). Les réservations ne passent que par la saga.
 * Chaque écriture est journalisée avec son auteur (traçabilité).
 */
@RestController
@RequestMapping("/api/v1/stock")
public class StockController {

    private static final Logger LOG = LoggerFactory.getLogger(StockController.class);

    private final StockRepository stock;
    private final ReservationMetrics metrics;

    public StockController(StockRepository stock, ReservationMetrics metrics) {
        this.stock = stock;
        this.metrics = metrics;
    }

    @GetMapping("/{productId}")
    public StockRepository.StockLevel get(@PathVariable UUID productId) {
        return stock.find(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun stock pour ce produit"));
    }

    /** Ajoute des unités (1 à 10 000) au stock disponible ; crée le stock d'un nouveau produit. */
    @PostMapping("/{productId}/restock")
    public StockRepository.StockLevel restock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID productId,
            @Valid @RequestBody RestockRequest request) {
        StockRepository.StockLevel level = stock.restock(productId, request.quantity());
        metrics.restocked(request.quantity());
        LOG.info("Réapprovisionnement du produit {} : +{} par {} (disponible : {})", productId, request.quantity(),
                author(jwt), level.available());
        return level;
    }

    /** Correction d'inventaire : fixe la quantité disponible (0 à 100 000) après un comptage. */
    @PutMapping("/{productId}")
    public StockRepository.StockLevel correct(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID productId,
            @Valid @RequestBody InventoryRequest request) {
        StockRepository.StockLevel level = stock.setAvailable(productId, request.available());
        LOG.info("Inventaire du produit {} corrigé à {} par {}", productId, request.available(), author(jwt));
        return level;
    }

    public record RestockRequest(@Min(1) @Max(10_000) int quantity) {
    }

    public record InventoryRequest(@Min(0) @Max(100_000) int available) {
    }

    private static String author(Jwt jwt) {
        String name = jwt.getClaimAsString("preferred_username");
        return name != null ? name : jwt.getSubject();
    }
}
