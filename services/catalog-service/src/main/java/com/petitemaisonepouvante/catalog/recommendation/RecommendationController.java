package com.petitemaisonepouvante.catalog.recommendation;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.catalog.product.ProductDto;
import com.petitemaisonepouvante.catalog.web.Problems;

/**
 * US13 — recommandations (lecture ouverte à tous, personnalisée pour un membre consentant) et réglage de la
 * personnalisation dans l'espace du membre : consentement, signaux d'intérêt, effacement de l'historique.
 */
@RestController
@RequestMapping("/api/v1")
public class RecommendationController {

    private final RecommendationService service;

    public RecommendationController(RecommendationService service) {
        this.service = service;
    }

    public record ItemDto(ProductDto product, String reason) {
    }

    public record RecommendationsDto(boolean personalized, List<ItemDto> items) {
    }

    /** Signal d'intérêt : un produit consulté ou acheté, ou une catégorie recherchée. */
    public record InterestRequest(@NotNull InterestKind kind, UUID productId, @Size(max = 100) String category) {
    }

    public record PreferencesDto(@NotNull Boolean personalized) {
    }

    @GetMapping("/recommendations")
    public RecommendationsDto recommendations(@AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) UUID exclude) {
        RecommendationService.Recommendations result = service.recommend(jwt == null ? null : jwt.getSubject(), exclude);
        return new RecommendationsDto(result.personalized(), result.items().stream()
                .map(item -> new ItemDto(ProductDto.from(item.product()), item.reason())).toList());
    }

    /** 202 dans tous les cas valides : sans consentement, le signal est ignoré et rien n'est conservé. */
    @PostMapping("/interests")
    public ResponseEntity<Void> record(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody InterestRequest request) {
        boolean hasProduct = request.productId() != null;
        boolean hasCategory = request.category() != null && !request.category().isBlank();
        if (hasProduct == hasCategory) {
            throw Problems.badRequest("Indiquer un produit ou une catégorie (et un seul).");
        }
        service.record(jwt.getSubject(), request.kind(), request.productId(),
                hasCategory ? request.category().strip() : null);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/interests/preferences")
    public PreferencesDto preferences(@AuthenticationPrincipal Jwt jwt) {
        return new PreferencesDto(service.isEnabled(jwt.getSubject()));
    }

    @PutMapping("/interests/preferences")
    public PreferencesDto savePreferences(@AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PreferencesDto preferences) {
        service.setEnabled(jwt.getSubject(), preferences.personalized());
        return preferences;
    }

    /** Droit à l'effacement : supprime l'historique de navigation et d'achat utilisé pour les recommandations. */
    @DeleteMapping("/interests")
    public ResponseEntity<Void> forget(@AuthenticationPrincipal Jwt jwt) {
        service.forget(jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
