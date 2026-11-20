package com.petitemaisonepouvante.catalog.product;

import java.util.Arrays;
import java.util.Optional;

/**
 * Formats d'image acceptés (US21). Le format est reconnu à la signature du fichier (premiers octets) et doit
 * correspondre au type annoncé par le client : un fichier HTML ou SVG renommé en .png est refusé (OWASP A03, A04).
 * SVG n'est pas accepté : il peut contenir du script.
 */
public enum ImageFormat {
    JPEG("image/jpeg"),
    PNG("image/png"),
    WEBP("image/webp");

    private static final byte[] PNG_SIGNATURE = {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n'};

    private final String mediaType;

    ImageFormat(String mediaType) {
        this.mediaType = mediaType;
    }

    public String mediaType() {
        return mediaType;
    }

    public static Optional<ImageFormat> ofMediaType(String mediaType) {
        if (mediaType == null) {
            return Optional.empty();
        }
        String base = mediaType.split(";", 2)[0].strip().toLowerCase(java.util.Locale.ROOT);
        return Arrays.stream(values()).filter(f -> f.mediaType.equals(base)).findFirst();
    }

    /** Format reconnu d'après la signature des données, ou vide si ce n'est pas une image acceptée. */
    public static Optional<ImageFormat> detect(byte[] data) {
        if (data.length >= 3 && (data[0] & 0xFF) == 0xFF && (data[1] & 0xFF) == 0xD8 && (data[2] & 0xFF) == 0xFF) {
            return Optional.of(JPEG);
        }
        if (data.length >= PNG_SIGNATURE.length
                && Arrays.equals(Arrays.copyOf(data, PNG_SIGNATURE.length), PNG_SIGNATURE)) {
            return Optional.of(PNG);
        }
        if (data.length >= 12 && data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F'
                && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P') {
            return Optional.of(WEBP);
        }
        return Optional.empty();
    }
}
