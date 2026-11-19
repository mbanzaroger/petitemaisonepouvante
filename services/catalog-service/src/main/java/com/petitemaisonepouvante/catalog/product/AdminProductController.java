package com.petitemaisonepouvante.catalog.product;

import java.net.URI;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.petitemaisonepouvante.catalog.web.Problems;

/**
 * US18 — gestion des produits par l'administrateur (rôle ADMIN exigé par le Gateway et par SecurityConfig) :
 * liste complète, création, modification et retrait de la vente. Le stock d'un nouveau produit est alimenté
 * ensuite dans stock-service (réapprovisionnement). Chaque écriture est journalisée avec son auteur (traçabilité).
 */
@RestController
@RequestMapping("/api/v1/catalog/admin/products")
public class AdminProductController {

    private static final Logger LOG = LoggerFactory.getLogger(AdminProductController.class);

    private final ProductRepository products;

    public AdminProductController(ProductRepository products) {
        this.products = products;
    }

    @GetMapping
    public PageDto<ProductDto> list(@RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size) {
        return PageDto.of(products.findAll(page, size).stream().map(ProductDto::from).toList(), page, size,
                products.countAll());
    }

    @PostMapping
    public ResponseEntity<ProductDto> create(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ProductRequest request) {
        long category = category(request.category());
        UUID id;
        try {
            id = products.insert(request.sku(), request.name().strip(), description(request.description()),
                    request.priceCents(), category, request.exclusive());
        } catch (DuplicateKeyException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "La référence " + request.sku() + " existe déjà.");
        }
        LOG.info("Produit {} ({}) créé par {}", id, request.sku(), author(jwt));
        return ResponseEntity.created(URI.create("/api/v1/products/" + id))
                .body(ProductDto.from(products.findById(id).orElseThrow()));
    }

    @PutMapping("/{id}")
    public ProductDto update(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
            @Valid @RequestBody ProductUpdateRequest request) {
        long category = category(request.category());
        boolean found = products.update(id, request.name().strip(), description(request.description()),
                request.priceCents(), category, request.exclusive(), request.active());
        if (!found) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Produit introuvable");
        }
        LOG.info("Produit {} modifié par {} (en vente : {})", id, author(jwt), request.active());
        return ProductDto.from(products.findById(id).orElseThrow());
    }

    private long category(String name) {
        return products.findCategoryId(name.strip())
                .orElseThrow(() -> Problems.badRequest("Catégorie inconnue : " + name));
    }

    private static String description(String description) {
        return description == null ? "" : description.strip();
    }

    private static String author(Jwt jwt) {
        String name = jwt.getClaimAsString("preferred_username");
        return name != null ? name : jwt.getSubject();
    }
}
