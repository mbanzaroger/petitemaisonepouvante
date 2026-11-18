package com.petitemaisonepouvante.community.notification;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PreferencesTest {

    @Test
    void filtreLesNotificationsParCategorie() {
        Preferences preferences = new Preferences(false, true, false);
        assertThat(preferences.accepts(NotificationType.NEW_OFFER)).isFalse();
        assertThat(preferences.accepts(NotificationType.OFFER_ACCEPTED)).isFalse();
        assertThat(preferences.accepts(NotificationType.NEW_MESSAGE)).isTrue();
        assertThat(preferences.accepts(NotificationType.WISH_MATCH)).isFalse();
    }

    @Test
    void laModerationEstToujoursNotifiee() {
        assertThat(new Preferences(false, false, false).accepts(NotificationType.CONTENT_HIDDEN)).isTrue();
    }

    @Test
    void tronqueLesTextesTropLongs() {
        assertThat(NotificationService.truncate("court")).isEqualTo("court");
        String tronque = NotificationService.truncate("x".repeat(400));
        assertThat(tronque).hasSize(NotificationService.MAX_TEXT).endsWith("…");
    }
}
