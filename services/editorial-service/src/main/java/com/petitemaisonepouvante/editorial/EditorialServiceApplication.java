package com.petitemaisonepouvante.editorial;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Éditions de La Petite Maison : actualités et articles de fond, fanzine numérique et abonnements. */
@SpringBootApplication
@EnableScheduling
public class EditorialServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(EditorialServiceApplication.class, args);
    }

    /** Horloge métier (échéances d'abonnement) à l'heure de Paris, remplaçable dans les tests. */
    @Bean
    Clock clock() {
        return Clock.system(ZoneId.of("Europe/Paris"));
    }
}
