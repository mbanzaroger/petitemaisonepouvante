package com.petitemaisonepouvante.community.listing;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.OffsetDateTime;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.petitemaisonepouvante.community.security.Member;

class ListingRepositoryTest {

    @Test
    void neutraliseLesCaracteresSpeciauxDeLike() {
        assertThat(ListingRepository.escapeLike("100%_vrai\\")).isEqualTo("100\\%\\_vrai\\\\");
    }

    @Test
    void uneAnnonceRetireeNEstVisibleQueDeSonAuteurEtDeLaModeration() {
        Listing retiree = new Listing(UUID.randomUUID(), "sujet-alice", "alice", ListingType.GIFT, "Titre", "Texte",
                Category.OTHER, ItemCondition.GOOD, null, ListingStatus.WITHDRAWN, OffsetDateTime.now(),
                OffsetDateTime.now());
        assertThat(retiree.visibleTo(null)).isFalse();
        assertThat(retiree.visibleTo(new Member("sujet-carol", "carol", false))).isFalse();
        assertThat(retiree.visibleTo(new Member("sujet-alice", "alice", false))).isTrue();
        assertThat(retiree.visibleTo(new Member("sujet-admin", "admin-pme", true))).isTrue();
    }
}
