package com.petitemaisonepouvante.editorial.subscription;

import java.time.Clock;
import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Durée de conservation (RGPD, docs/13 §10) appliquée chaque nuit : l'adresse de livraison du fanzine papier est
 * effacée 90 jours après l'échéance de l'abonnement (dernier envoi et réclamations éventuelles).
 */
@Component
public class AddressRetentionTask {

    private static final Logger LOG = LoggerFactory.getLogger(AddressRetentionTask.class);

    private final SubscriptionRepository subscriptions;
    private final Clock clock;
    private final int addressDays;

    public AddressRetentionTask(SubscriptionRepository subscriptions, Clock clock,
            @Value("${pme.editorial.retention.address-days:90}") int addressDays) {
        this.subscriptions = subscriptions;
        this.clock = clock;
        this.addressDays = addressDays;
    }

    @Scheduled(cron = "${pme.editorial.retention.cron:0 45 3 * * *}")
    @Transactional
    public int purge() {
        int erased = subscriptions.eraseAddressesEndedBefore(LocalDate.now(clock).minusDays(addressDays));
        LOG.info("Purge de conservation : {} adresse(s) de livraison effacée(s)", erased);
        return erased;
    }
}
