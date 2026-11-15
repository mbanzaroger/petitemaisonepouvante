package com.petitemaisonepouvante.catalog.product;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class PageDtoTest {

    @Test
    void calculeLeNombreDePagesArrondiAuSuperieur() {
        assertThat(PageDto.of(List.of(), 0, 5, 11).totalPages()).isEqualTo(3);
        assertThat(PageDto.of(List.of(), 0, 5, 10).totalPages()).isEqualTo(2);
        assertThat(PageDto.of(List.of(), 0, 20, 0).totalPages()).isZero();
    }

    @Test
    void exposeLePrixEnCentimesEtLaDisponibilite() {
        Product product = new Product(UUID.randomUUID(), "SKU-1", "Mug", "desc", 1290, "EUR", "Goodies", false);

        ProductDto dto = ProductDto.from(product);

        assertThat(dto.price()).isEqualTo(new ProductDto.Price(1290, "EUR"));
        assertThat(dto.available()).isFalse();
        assertThat(dto.category()).isEqualTo("Goodies");
    }
}
