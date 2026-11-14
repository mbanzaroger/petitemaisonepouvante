package com.petitemaisonepouvante.stock.api;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.petitemaisonepouvante.stock.reservation.StockRepository;

/** Consultation du stock d'un produit, réservée au rôle ADMIN (supervision et démonstration de la saga). */
@RestController
@RequestMapping("/api/v1/stock")
public class StockController {

    private final StockRepository stock;

    public StockController(StockRepository stock) {
        this.stock = stock;
    }

    @GetMapping("/{productId}")
    public StockRepository.StockLevel get(@PathVariable UUID productId) {
        return stock.find(productId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Aucun stock pour ce produit"));
    }
}
