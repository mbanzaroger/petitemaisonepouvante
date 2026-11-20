package com.petitemaisonepouvante.catalog.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class ImageFormatTest {

    @Test
    void reconnaitLesSignaturesAcceptees() {
        assertThat(ImageFormat.detect(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x00}))
                .contains(ImageFormat.JPEG);
        assertThat(ImageFormat.detect(new byte[] {(byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0}))
                .contains(ImageFormat.PNG);
        assertThat(ImageFormat.detect("RIFF\0\0\0\0WEBPVP8 ".getBytes(StandardCharsets.ISO_8859_1)))
                .contains(ImageFormat.WEBP);
    }

    @Test
    void refuseLesAutresContenus() {
        assertThat(ImageFormat.detect("<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8)))
                .isEmpty();
        assertThat(ImageFormat.detect("<html><script>alert(1)</script>".getBytes(StandardCharsets.UTF_8))).isEmpty();
        assertThat(ImageFormat.detect("GIF89a".getBytes(StandardCharsets.US_ASCII))).isEmpty();
        assertThat(ImageFormat.detect(new byte[0])).isEmpty();
    }

    @Test
    void litLeTypeAnnonce() {
        assertThat(ImageFormat.ofMediaType("image/PNG; charset=binary")).contains(ImageFormat.PNG);
        assertThat(ImageFormat.ofMediaType("image/svg+xml")).isEmpty();
        assertThat(ImageFormat.ofMediaType(null)).isEmpty();
    }

    @Test
    void motifDeRechercheSansAccentsEtEchappe() {
        assertThat(ProductRepository.motif("  Épouvante ")).isEqualTo("epouvante");
        assertThat(ProductRepository.motif("Cœur")).isEqualTo("cour");
        assertThat(ProductRepository.motif("100%_a\\b")).isEqualTo("100\\%\\_a\\\\b");
    }

    @Test
    void versionCourteDeLImage() {
        assertThat(ProductImage.version("a".repeat(64))).hasSize(16);
        assertThat(ProductImage.version(null)).isNull();
    }
}
