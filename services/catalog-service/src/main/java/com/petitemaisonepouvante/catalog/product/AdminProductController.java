package com.petitemaisonepouvante.catalog.product;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
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
import org.springframework.web.bind.annotation.DeleteMapping;
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
 * ensuite dans stock-service (réapprovisionnement). US21 — image de chaque produit (ajout, remplacement, retrait).
 * Chaque écriture est journalisée avec son auteur (traçabilité).
 */
@RestController
@RequestMapping("/api/v1/catalog/admin/products")
public class AdminProductController {

    private static final Logger LOG = LoggerFactory.getLogger(AdminProductController.class);

    /** Taille maximale d'une image : 2 Mio (une photo de produit compressée en pèse généralement moins de 500 Kio). */
    static final int MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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

    /**
     * US21 — ajoute ou remplace l'image d'un produit. Corps brut de type image/jpeg, image/png ou image/webp
     * (415 sinon) ; le contenu doit être une image de ce type, reconnue à sa signature (415), de 2 Mio au plus
     * (413, lecture interrompue au-delà : rien n'est chargé en mémoire au-delà de la limite).
     */
    @PutMapping(value = "/{id}/image", consumes = {"image/jpeg", "image/png", "image/webp"})
    public ProductDto putImage(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id, HttpServletRequest request)
            throws IOException {
        if (request.getContentLengthLong() > MAX_IMAGE_BYTES) {
            throw tooLarge();
        }
        byte[] data;
        try (InputStream body = request.getInputStream()) {
            data = body.readNBytes(MAX_IMAGE_BYTES + 1);
        }
        if (data.length > MAX_IMAGE_BYTES) {
            throw tooLarge();
        }
        ImageFormat declared = ImageFormat.ofMediaType(request.getContentType()).orElseThrow();
        ImageFormat actual = ImageFormat.detect(data).orElseThrow(() -> Problems.of(415,
                "Le fichier n'est pas une image JPEG, PNG ou WebP."));
        if (actual != declared) {
            throw Problems.of(415, "Le fichier est une image " + actual.name() + " mais a été envoyé comme "
                    + declared.mediaType() + ".");
        }
        if (!products.exists(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Produit introuvable");
        }
        products.saveImage(id, actual, data, sha256(data), author(jwt));
        LOG.info("Image du produit {} remplacée par {} ({} octets, {})", id, author(jwt), data.length,
                actual.mediaType());
        return ProductDto.from(products.findById(id).orElseThrow());
    }

    /** US21 — retire l'image d'un produit (le site affiche alors un visuel générique). */
    @DeleteMapping("/{id}/image")
    public ResponseEntity<Void> deleteImage(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        if (!products.exists(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Produit introuvable");
        }
        if (products.deleteImage(id)) {
            LOG.info("Image du produit {} retirée par {}", id, author(jwt));
        }
        return ResponseEntity.noContent().build();
    }

    private static RuntimeException tooLarge() {
        return Problems.of(413, "Image trop lourde : 2 Mo au plus.");
    }

    static String sha256(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponible", e);
        }
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
