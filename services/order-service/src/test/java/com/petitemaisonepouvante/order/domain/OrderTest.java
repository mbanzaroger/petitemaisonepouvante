package com.petitemaisonepouvante.order.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class OrderTest {

    private static OrderLine line(int quantity, int unitPrice) {
        return new OrderLine(1, UUID.randomUUID(), "Produit", quantity, unitPrice);
    }

    @Test
    void leTotalEstLaSommeDesSousTotaux() {
        assertThat(Order.total(List.of(line(2, 5990), line(1, 1290)))).isEqualTo(13270);
        assertThat(line(3, 1290).subtotalCents()).isEqualTo(3870);
    }

    @Test
    void unDepassementDeCapaciteEstRefuseAuLieuDEtreTronque() {
        assertThatThrownBy(() -> line(10, Integer.MAX_VALUE).subtotalCents()).isInstanceOf(ArithmeticException.class);
        assertThatThrownBy(() -> Order.total(List.of(line(1, Integer.MAX_VALUE), line(1, 1))))
                .isInstanceOf(ArithmeticException.class);
    }
}
