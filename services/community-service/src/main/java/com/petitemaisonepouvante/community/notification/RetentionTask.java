package com.petitemaisonepouvante.community.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.community.chat.MessageRepository;

/**
 * Durées de conservation (RGPD, docs/13) appliquées chaque nuit : notifications lues après 90 jours, messages des
 * salons après 365 jours, centres d'intérêt sans consultation depuis 180 jours. Les conversations des propositions
 * suivent la vie de l'annonce (non purgées ici).
 */
@Component
public class RetentionTask {

    private static final Logger LOG = LoggerFactory.getLogger(RetentionTask.class);

    private final NotificationRepository notifications;
    private final MessageRepository messages;
    private final int notificationDays;
    private final int roomMessageDays;
    private final int interestDays;

    public RetentionTask(NotificationRepository notifications, MessageRepository messages,
            @Value("${pme.community.retention.notification-days:90}") int notificationDays,
            @Value("${pme.community.retention.room-message-days:365}") int roomMessageDays,
            @Value("${pme.community.retention.interest-days:180}") int interestDays) {
        this.notifications = notifications;
        this.messages = messages;
        this.notificationDays = notificationDays;
        this.roomMessageDays = roomMessageDays;
        this.interestDays = interestDays;
    }

    @Scheduled(cron = "${pme.community.retention.cron:0 30 3 * * *}")
    @Transactional
    public void purge() {
        int deletedNotifications = notifications.deleteReadOlderThan(notificationDays);
        int deletedMessages = messages.deleteRoomMessagesOlderThan(roomMessageDays);
        int deletedInterests = notifications.deleteStaleInterests(interestDays);
        LOG.info("Purge de conservation : {} notification(s), {} message(s) de salon, {} centre(s) d'intérêt supprimés",
                deletedNotifications, deletedMessages, deletedInterests);
    }
}
