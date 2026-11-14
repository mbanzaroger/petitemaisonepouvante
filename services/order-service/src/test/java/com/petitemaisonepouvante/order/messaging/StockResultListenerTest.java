package com.petitemaisonepouvante.order.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;

import com.petitemaisonepouvante.order.domain.OrderService;

import tools.jackson.databind.json.JsonMapper;

class StockResultListenerTest {

    private final StockResultListener listener = new StockResultListener(mock(OrderService.class), JsonMapper.builder().build());

    private static byte[] utf8(String s) {
        return s.getBytes(StandardCharsets.UTF_8);
    }

    @Test
    void litUnEvenementStockReserved() {
        UUID order = UUID.randomUUID();
        Events.StockResult result = listener.parse(utf8("{\"eventId\":\"" + UUID.randomUUID()
                + "\",\"type\":\"StockReserved\",\"orderId\":\"" + order + "\",\"champInconnu\":1}"));
        assertThat(result.reserved()).isTrue();
        assertThat(result.orderId()).isEqualTo(order);
    }

    @Test
    void rejetteSansRemiseEnFileUnMessageIllisibleOuIncomplet() {
        assertThatThrownBy(() -> listener.parse(utf8("pas du json")))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
        assertThatThrownBy(() -> listener.parse(utf8("{\"type\":\"StockReserved\"}")))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
        assertThatThrownBy(() -> listener.parse(utf8("{\"eventId\":\"" + UUID.randomUUID()
                + "\",\"type\":\"Inconnu\",\"orderId\":\"" + UUID.randomUUID() + "\"}")))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
    }
}
