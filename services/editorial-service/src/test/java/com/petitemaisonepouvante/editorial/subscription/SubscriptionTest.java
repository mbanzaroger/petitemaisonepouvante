package com.petitemaisonepouvante.editorial.subscription;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

class SubscriptionTest {

    @Test
    void estActifJusquALEcheanceIncluse() {
        LocalDate fin = LocalDate.of(2027, 2, 26);
        Subscription abonnement = new Subscription("m", "alice", Plan.DIGITAL, fin.minusYears(1), fin, null);
        assertThat(abonnement.activeOn(fin)).isTrue();
        assertThat(abonnement.activeOn(fin.plusDays(1))).isFalse();
    }

    @Test
    void laFormulePapierInclutLeNumerique() {
        assertThat(Plan.PAPER_DIGITAL.paper()).isTrue();
        assertThat(Plan.PAPER_DIGITAL.priceCents()).isGreaterThan(Plan.DIGITAL.priceCents());
        assertThat(Plan.DIGITAL.label()).isEqualTo("Numérique");
    }
}
