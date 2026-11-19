package com.petitemaisonepouvante.editorial.subscription;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.editorial.AbstractIntegrationTest;

/** US17 — abonnement au fanzine (numérique, papier et numérique), renouvellement et liste d'expédition. */
class SubscriptionApiIT extends AbstractIntegrationTest {

    private static final String API = "/api/v1/editorial";
    private static final Map<String, String> ADRESSE = Map.of("recipient", "Alice Martin", "street", "12 rue des Ombres",
            "postalCode", "75011", "city", "Paris");

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private AddressRetentionTask retention;

    private static LocalDate aujourdhui() {
        return LocalDate.now(ZoneId.of("Europe/Paris"));
    }

    private ResultActions subscribe(RequestPostProcessor who, String path, Object request) throws Exception {
        return mvc.perform(post(API + path).with(who).contentType(MediaType.APPLICATION_JSON).content(body(request)));
    }

    private void echeance(String name, LocalDate fin) {
        jdbc.update("update subscription set ends_on = ?, starts_on = least(starts_on, ?) where member_id = ?", fin,
                fin.minusYears(1), "sub-" + name);
    }

    @Test
    @DisplayName("Les formules sont publiques ; un abonnement numérique donne accès à tous les numéros")
    void abonnementNumerique() throws Exception {
        mvc.perform(get(API + "/plans"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[1].paper", is(true)));
        String name = unique("carol");
        RequestPostProcessor carol = member(name);
        mvc.perform(get(API + "/subscription").with(carol)).andExpect(jsonPath("$.active", is(false)));

        subscribe(carol, "/subscription", Map.of("plan", "DIGITAL"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.active", is(true)))
                .andExpect(jsonPath("$.planLabel", is("Numérique")))
                .andExpect(jsonPath("$.endsOn", is(aujourdhui().plusYears(1).minusDays(1).toString())))
                .andExpect(jsonPath("$.renewable", is(false)))
                .andExpect(jsonPath("$.address").doesNotExist());
        subscribe(carol, "/subscription", Map.of("plan", "DIGITAL")).andExpect(status().isConflict());

        mvc.perform(get(API + "/issues/{n}/pages/{p}", 35, 3).with(carol))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access", is("SUBSCRIPTION")));
        mvc.perform(post(API + "/issues/{n}/purchase", 35).with(carol))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", is("Ce numéro est déjà inclus dans votre abonnement.")));
        mvc.perform(get(API + "/library").with(carol)).andExpect(jsonPath("$", hasSize(3)));

        subscribe(carol, "/subscription/renewal", Map.of("plan", "DIGITAL"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.detail", startsWith("Le renouvellement sera possible à partir du")));
    }

    @Test
    @DisplayName("Renouvellement à l'approche de l'échéance, passage au papier avec adresse, liste d'expédition")
    void renouvellementPapier() throws Exception {
        String name = unique("alice");
        RequestPostProcessor alice = member(name);
        subscribe(alice, "/subscription", Map.of("plan", "DIGITAL")).andExpect(status().isCreated());
        LocalDate fin = aujourdhui().plusDays(10);
        echeance(name, fin);

        subscribe(alice, "/subscription/renewal", Map.of("plan", "PAPER_DIGITAL"))
                .andExpect(status().is(422))
                .andExpect(jsonPath("$.detail", is("Une adresse de livraison est requise pour l'abonnement papier.")));
        subscribe(alice, "/subscription/renewal", Map.of("plan", "PAPER_DIGITAL",
                        "address", Map.of("recipient", "A", "street", "Rue", "postalCode", "750", "city", "Paris")))
                .andExpect(status().isBadRequest());
        subscribe(alice, "/subscription/renewal", Map.of("plan", "PAPER_DIGITAL", "address", ADRESSE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.plan", is("PAPER_DIGITAL")))
                .andExpect(jsonPath("$.endsOn", is(fin.plusYears(1).toString())))
                .andExpect(jsonPath("$.address.city", is("Paris")));
        assertThat(jdbc.queryForObject("select count(*) from subscription_event where member_id = ?", Integer.class,
                "sub-" + name)).isEqualTo(2);

        mvc.perform(get(API + "/admin/paper-subscribers").with(admin(unique("admin"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].memberName", hasItem(name)));
        mvc.perform(get(API + "/admin/paper-subscribers").with(alice)).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un abonnement échu ne donne plus accès ; il se renouvelle à partir d'aujourd'hui")
    void abonnementEchu() throws Exception {
        String name = unique("dave");
        RequestPostProcessor dave = member(name);
        subscribe(dave, "/subscription", Map.of("plan", "PAPER_DIGITAL", "address", ADRESSE))
                .andExpect(status().isCreated());
        echeance(name, aujourdhui().minusDays(1));

        mvc.perform(get(API + "/subscription").with(dave))
                .andExpect(jsonPath("$.active", is(false)))
                .andExpect(jsonPath("$.renewable", is(true)));
        mvc.perform(get(API + "/issues/{n}/pages/{p}", 37, 2).with(dave)).andExpect(status().isForbidden());
        mvc.perform(get(API + "/admin/paper-subscribers").with(admin(unique("admin"))))
                .andExpect(jsonPath("$[*].memberName", not(hasItem(name))));

        subscribe(dave, "/subscription/renewal", Map.of("plan", "DIGITAL"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active", is(true)))
                .andExpect(jsonPath("$.startsOn", is(aujourdhui().toString())))
                .andExpect(jsonPath("$.address").doesNotExist());
        subscribe(member(unique("eve")), "/subscription/renewal", Map.of("plan", "DIGITAL"))
                .andExpect(status().isNotFound());
        subscribe(dave, "/subscription", Map.of("plan", "MENSUEL")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("L'adresse de livraison est effacée 90 jours après l'échéance, pas avant (RGPD)")
    void conservationDesAdresses() throws Exception {
        String ancien = unique("frank");
        String recent = unique("grace");
        subscribe(member(ancien), "/subscription", Map.of("plan", "PAPER_DIGITAL", "address", ADRESSE))
                .andExpect(status().isCreated());
        subscribe(member(recent), "/subscription", Map.of("plan", "PAPER_DIGITAL", "address", ADRESSE))
                .andExpect(status().isCreated());
        echeance(ancien, aujourdhui().minusDays(91));
        echeance(recent, aujourdhui().minusDays(89));

        assertThat(retention.purge()).isPositive();

        mvc.perform(get(API + "/subscription").with(member(ancien)))
                .andExpect(jsonPath("$.plan", is("PAPER_DIGITAL")))
                .andExpect(jsonPath("$.address").doesNotExist());
        mvc.perform(get(API + "/subscription").with(member(recent)))
                .andExpect(jsonPath("$.address.city", is("Paris")));
        subscribe(member(ancien), "/subscription/renewal", Map.of("plan", "PAPER_DIGITAL"))
                .andExpect(status().is(422));
    }
}
