package com.petitemaisonepouvante.catalog.migration;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.PreparedStatement;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;
import org.springframework.stereotype.Component;

/**
 * US21 — images des produits de démonstration (V2), lues dans {@code db/demo-images/<référence>.webp}. Migration
 * Java (déclarée comme composant : Spring Boot la transmet à Flyway) car les images sont des fichiers binaires.
 * Un produit absent ou ayant déjà une image n'est pas modifié. Visuels originaux, générés pour le projet
 * ({@code scripts/images-demo}).
 */
@Component
public class V5__images_de_demonstration extends BaseJavaMigration {

    private static final Map<String, String> PRODUITS = new LinkedHashMap<>();

    static {
        PRODUITS.put("0f6c1a10-0001-4000-8000-000000000001", "FIG-ORC-001");
        PRODUITS.put("0f6c1a10-0002-4000-8000-000000000002", "FIG-ORC-002");
        PRODUITS.put("0f6c1a10-0003-4000-8000-000000000003", "FIG-SPC-003");
        PRODUITS.put("0f6c1a10-0004-4000-8000-000000000004", "BR-RIF-001");
        PRODUITS.put("0f6c1a10-0005-4000-8000-000000000005", "BR-FES-002");
        PRODUITS.put("0f6c1a10-0006-4000-8000-000000000006", "JDS-MAN-001");
        PRODUITS.put("0f6c1a10-0007-4000-8000-000000000007", "JDS-CRY-002");
        PRODUITS.put("0f6c1a10-0008-4000-8000-000000000008", "GOO-MUG-001");
        PRODUITS.put("0f6c1a10-0009-4000-8000-000000000009", "GOO-TSH-002");
        PRODUITS.put("0f6c1a10-0010-4000-8000-000000000010", "BD-ORC-001");
        PRODUITS.put("0f6c1a10-0011-4000-8000-000000000011", "FZ-037-001");
        PRODUITS.put("0f6c1a10-0012-4000-8000-000000000012", "GOO-AFF-003");
    }

    @Override
    public void migrate(Context context) throws Exception {
        String sql = """
                insert into product_image (product_id, content_type, data, size_bytes, etag, updated_by)
                select ?, 'image/webp', ?, ?, ?, 'données de démonstration'
                where exists (select 1 from product where id = ?)
                on conflict (product_id) do nothing
                """;
        try (PreparedStatement insert = context.getConnection().prepareStatement(sql)) {
            for (Map.Entry<String, String> produit : PRODUITS.entrySet()) {
                UUID id = UUID.fromString(produit.getKey());
                byte[] image = lire("/db/demo-images/" + produit.getValue() + ".webp");
                insert.setObject(1, id);
                insert.setBytes(2, image);
                insert.setInt(3, image.length);
                insert.setString(4, sha256(image));
                insert.setObject(5, id);
                insert.addBatch();
            }
            insert.executeBatch();
        }
    }

    private static byte[] lire(String chemin) {
        try (InputStream entree = V5__images_de_demonstration.class.getResourceAsStream(chemin)) {
            if (entree == null) {
                throw new IllegalStateException("Image de démonstration absente : " + chemin);
            }
            return entree.readAllBytes();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static String sha256(byte[] data) throws NoSuchAlgorithmException {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
    }
}
