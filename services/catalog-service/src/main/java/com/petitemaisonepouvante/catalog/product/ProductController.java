package com.petitemaisonepouvante.catalog.product;

import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/**
 * US1 — lister et consulter les produits. Lecture publique (aucun jeton requis).
 * Les contraintes sur les paramètres sont validées par Spring MVC : une valeur invalide renvoie 400 (problem+json).
 */
@RestController
@RequestMapping("/api/v1")
public class ProductController {

    private final ProductRepository products;

    public ProductController(ProductRepository products) {
        this.products = products;
    }

    @GetMapping(value = "/products", params = "!ids")
    public PageDto<ProductDto> list(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @Size(max = 100) String category) {
        List<ProductDto> content = products.findActive(category, page, size).stream().map(ProductDto::from).toList();
        return PageDto.of(content, page, size, products.countActive(category));
    }

    /** Lecture groupée utilisée par order-service pour relire les prix côté serveur. */
    @GetMapping(value = "/products", params = "ids")
    public List<ProductDto> byIds(@RequestParam @Size(min = 1, max = 50) List<UUID> ids) {
        return products.findAllById(ids).stream().map(ProductDto::from).toList();
    }

    @GetMapping("/products/{id}")
    public ProductDto get(@PathVariable UUID id) {
        return products.findById(id)
                .map(ProductDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Produit introuvable"));
    }

    @GetMapping("/categories")
    public List<String> categories() {
        return products.findCategoryNames();
    }
}
