package com.petitemaisonepouvante.editorial.subscription;

import java.time.LocalDate;

/** Abonnement d'un membre (une ligne par membre, prolongée à chaque renouvellement). */
public record Subscription(String memberId, String memberName, Plan plan, LocalDate startsOn, LocalDate endsOn,
        Address address) {

    /** Actif jusqu'à la date d'échéance incluse. */
    public boolean activeOn(LocalDate day) {
        return !day.isAfter(endsOn);
    }
}
