package com.petitemaisonepouvante.catalog.product;

/** Image d'un produit telle que stockée : type, octets et empreinte SHA-256 (ETag). */
public record ProductImage(String contentType, byte[] data, String etag) {

    /** Version courte placée dans l'URL de l'image : une nouvelle image change l'URL (cache navigateur). */
    public static String version(String etag) {
        return etag == null ? null : etag.strip().substring(0, 16);
    }
}
