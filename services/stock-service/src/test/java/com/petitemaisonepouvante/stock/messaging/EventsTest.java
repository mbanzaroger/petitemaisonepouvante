package com.petitemaisonepouvante.stock.messaging;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.AmqpRejectAndDontRequeueException;

import com.petitemaisonepouvante.stock.reservation.ReservationService;

import tools.jackson.databind.json.JsonMapper;

class EventsTest {

    private final OrderPlacedListener listener =
            new OrderPlacedListener(mock(ReservationService.class), JsonMapper.builder().build());

    private static Events.OrderPlaced event(List<Events.OrderPlaced.Line> lines) {
        return new Events.OrderPlaced(UUID.randomUUID(), "OrderPlaced", UUID.randomUUID(), "c-1", lines);
    }

    @Test
    void uneCommandeSansLigneOuAvecQuantiteNulleEstInvalide() {
        assertThat(event(List.of(new Events.OrderPlaced.Line(UUID.randomUUID(), 2))).valid()).isTrue();
        assertThat(event(List.of()).valid()).isFalse();
        assertThat(event(null).valid()).isFalse();
        assertThat(event(List.of(new Events.OrderPlaced.Line(UUID.randomUUID(), 0))).valid()).isFalse();
        assertThat(event(List.of(new Events.OrderPlaced.Line(null, 1))).valid()).isFalse();
    }

    @Test
    void lesResultatsPortentUnIdentifiantDEvenementUniqueEtLeTypeAttendu() {
        UUID order = UUID.randomUUID();
        Events.StockResult reserved = Events.StockResult.reserved(order, "c-1");
        Events.StockResult rejected = Events.StockResult.rejected(order, "c-1", "stock insuffisant");
        assertThat(reserved.type()).isEqualTo("StockReserved");
        assertThat(rejected.type()).isEqualTo("StockRejected");
        assertThat(rejected.reason()).isEqualTo("stock insuffisant");
        assertThat(reserved.eventId()).isNotEqualTo(rejected.eventId());
    }

    @Test
    void unMessageIllisibleOuSansIdentifiantEstRejeteSansRemiseEnFile() {
        assertThatThrownBy(() -> listener.parse("{oups".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
        assertThatThrownBy(() -> listener.parse("{\"type\":\"OrderPlaced\"}".getBytes(StandardCharsets.UTF_8)))
                .isInstanceOf(AmqpRejectAndDontRequeueException.class);
    }
}
