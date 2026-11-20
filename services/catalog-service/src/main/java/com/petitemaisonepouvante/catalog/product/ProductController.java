package com.petitemaisonepouvante.catalog.product;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.petitemaisonepouvante.catalog.product.ProductRepository.CatalogFilter;
import com.petitemaisonepouvante.catalog.web.Problems;

/**
 * US1 — lister et consulter les produits ; US21 — leurs images ; US22 — recherche et tri. Lecture publique (aucun
 * jeton requis). Les contraintes sur les paramètres sont validées par Spring MVC : une valeur invalide renvoie 400
 * (problem+json).
 */
@RestController
@RequestMapping("/api/v1")
public class ProductController {

    /**
     * Une image servie à son adresse versionnée ne change jamais (une nouvelle image change l'adresse) : cache d'un
     * an. Sans version, ou avec une version périmée, le navigateur revalide à chaque fois (ETag, 304).
     */
    private static final CacheControl IMMUABLE = CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable();
    private static final CacheControl A_REVALIDER = CacheControl.noCache().cachePublic();

    private final ProductRepository products;

    public ProductController(ProductRepository products) {
        this.products = products;
    }

    @GetMapping(value = "/products", params = "!ids")
    public PageDto<ProductDto> list(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size,
            @RequestParam(required = false) @Size(max = 100) String category,
            @RequestParam(defaultValue = "false") boolean exclusive,
            @RequestParam(required = false) @Size(max = 100) String q,
            @RequestParam(defaultValue = "name") String sort) {
        ProductSort order = ProductSort.of(sort)
                .orElseThrow(() -> Problems.badRequest("Tri inconnu : name, price-asc, price-desc ou newest."));
        String query = q == null || q.isBlank() ? null : q.strip();
        CatalogFilter filter = new CatalogFilter(category, exclusive, query);
        List<ProductDto> content = products.findActive(filter, order, page, size).stream()
                .map(ProductDto::from).toList();
        return PageDto.of(content, page, size, products.countActive(filter));
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

    /**
     * US21 — image d'un produit, servie avec son type exact, sans interprétation possible par le navigateur
     * (X-Content-Type-Options posé par Spring Security, CSP « sandbox ») et avec un ETag (réponse 304 si inchangée).
     */
    @GetMapping("/products/{id}/image")
    public ResponseEntity<byte[]> image(@PathVariable UUID id, @RequestParam(required = false) String v,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch) {
        ProductImage image = products.findImage(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Image introuvable"));
        String etag = '"' + image.etag() + '"';
        CacheControl cache = ProductImage.version(image.etag()).equals(v) ? IMMUABLE : A_REVALIDER;
        if (ifNoneMatch != null && ifNoneMatch.contains(etag)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).cacheControl(cache).build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(image.contentType()))
                .eTag(etag)
                .cacheControl(cache)
                .header("Content-Security-Policy", "default-src 'none'; sandbox")
                .body(image.data());
    }

    @GetMapping("/categories")
    public List<String> categories() {
        return products.findCategoryNames();
    }
}
