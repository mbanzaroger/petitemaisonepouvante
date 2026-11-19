package com.petitemaisonepouvante.catalog.recommendation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Durée de conservation des signaux d'intérêt (RGPD) : purge quotidienne au-delà de 90 jours. */
@Component
public class InterestRetentionTask {

    private static final Logger LOG = LoggerFactory.getLogger(InterestRetentionTask.class);

    private final RecommendationService service;

    public InterestRetentionTask(RecommendationService service) {
        this.service = service;
    }

    @Scheduled(cron = "${pme.recommendations.retention-cron:0 15 3 * * *}")
    public void purge() {
        LOG.info("Purge de conservation : {} signal(aux) d'intérêt supprimé(s)", service.purge());
    }
}
