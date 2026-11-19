package com.petitemaisonepouvante.catalog.recommendation;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.catalog.product.Product;
import com.petitemaisonepouvante.catalog.product.ProductRepository;

/**
 * US13 — recommandations de produits selon les recherches, consultations et achats du membre (avec son consentement).
 * Sans consentement, sans historique ou pour un visiteur : sélection commune (exclusivités Evil Ed, puis nouveautés).
 * Les signaux ne sont enregistrés que si le membre a activé la personnalisation (minimisation, RGPD).
 */
@Service
public class RecommendationService {

    static final int COUNT = 4;
    static final int WINDOW_DAYS = 90;
    /** Plafond de signaux par membre et par 24 h : au-delà, ils sont ignorés (anti-abus, volume de données). */
    static final int MAX_SIGNALS_PER_DAY = 500;

    private final InterestRepository interests;
    private final ProductRepository products;
    private final int retentionDays;

    public RecommendationService(InterestRepository interests, ProductRepository products,
            @Value("${pme.recommendations.retention-days:90}") int retentionDays) {
        this.interests = interests;
        this.products = products;
        this.retentionDays = retentionDays;
    }

    /** Produit recommandé et raison affichée au membre (transparence). */
    public record Recommendation(Product product, String reason) {
    }

    /** {@code personalized} : le membre a activé la personnalisation (le site n'envoie de signaux qu'à cette condition). */
    public record Recommendations(boolean personalized, List<Recommendation> items) {
    }

    @Transactional(readOnly = true)
    public Recommendations recommend(String memberId, UUID exclude) {
        boolean personalized = memberId != null && interests.isEnabled(memberId);
        Map<UUID, Recommendation> chosen = new LinkedHashMap<>();
        Set<UUID> excluded = new HashSet<>();
        if (exclude != null) {
            excluded.add(exclude);
        }
        if (personalized) {
            excluded.addAll(interests.purchasedProducts(memberId));
            List<InterestRepository.CategoryScore> top = interests.topCategories(memberId, WINDOW_DAYS, 3);
            if (!top.isEmpty()) {
                Map<Long, String> names = new LinkedHashMap<>();
                top.forEach(score -> names.put(score.categoryId(), score.name()));
                List<Product> candidates = new ArrayList<>(products.findActiveInCategories(names.keySet(), 30));
                // Ordre des catégories du plus fort au plus faible intérêt, exclusivités d'abord dans chacune.
                List<Long> rank = new ArrayList<>(names.keySet());
                candidates.sort((a, b) -> Integer.compare(rank.indexOf(categoryId(names, a)),
                        rank.indexOf(categoryId(names, b))));
                for (Product product : candidates) {
                    if (chosen.size() < COUNT && !excluded.contains(product.id())) {
                        chosen.put(product.id(), new Recommendation(product,
                                "Parce que vous vous intéressez à la catégorie « " + product.category() + " »"));
                    }
                }
            }
        }
        for (Product product : products.findShowcase(COUNT * 3)) {
            if (chosen.size() < COUNT && !excluded.contains(product.id()) && !chosen.containsKey(product.id())) {
                chosen.put(product.id(), new Recommendation(product,
                        product.exclusive() ? "Exclusivité Evil Ed, uniquement sur le site" : "Sélection de la boutique"));
            }
        }
        return new Recommendations(personalized, List.copyOf(chosen.values()));
    }

    private static long categoryId(Map<Long, String> names, Product product) {
        return names.entrySet().stream().filter(entry -> entry.getValue().equals(product.category()))
                .map(Map.Entry::getKey).findFirst().orElse(Long.MAX_VALUE);
    }

    /** Enregistre un signal si le membre a consenti ; sinon il est ignoré (et rien n'est conservé). */
    @Transactional
    public boolean record(String memberId, InterestKind kind, UUID productId, String category) {
        if (!interests.isEnabled(memberId) || interests.countSince(memberId, 24) >= MAX_SIGNALS_PER_DAY) {
            return false;
        }
        if (productId != null) {
            return products.findCategoryIdOfProduct(productId).map(categoryId -> {
                interests.insertProductSignal(memberId, categoryId, productId, kind);
                return true;
            }).orElse(false);
        }
        return products.findCategoryId(category).map(categoryId -> {
            interests.insertCategorySignal(memberId, categoryId, kind);
            return true;
        }).orElse(false);
    }

    @Transactional(readOnly = true)
    public boolean isEnabled(String memberId) {
        return interests.isEnabled(memberId);
    }

    /** Retirer son consentement efface aussi l'historique de navigation déjà enregistré. */
    @Transactional
    public void setEnabled(String memberId, boolean enabled) {
        interests.setEnabled(memberId, enabled);
        if (!enabled) {
            interests.deleteAll(memberId);
        }
    }

    @Transactional
    public void forget(String memberId) {
        interests.deleteAll(memberId);
    }

    @Transactional
    public int purge() {
        return interests.deleteOlderThan(retentionDays);
    }
}
