package com.petitemaisonepouvante.editorial.subscription;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Abonnements et historique des souscriptions (paiements simulés) ; requêtes SQL paramétrées uniquement. */
@Repository
public class SubscriptionRepository {

    private static final String COLUMNS = "member_id, member_name, plan, starts_on, ends_on, recipient, street, "
            + "postal_code, city";

    private final JdbcClient jdbc;

    public SubscriptionRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Subscription> find(String memberId) {
        return jdbc.sql("select " + COLUMNS + " from subscription where member_id = :member")
                .param("member", memberId)
                .query(SubscriptionRepository::map)
                .optional();
    }

    /** Crée ou remplace l'abonnement du membre (nouvelle souscription après échéance comprise). */
    public void save(Subscription subscription) {
        Address address = subscription.address();
        jdbc.sql("""
                insert into subscription (id, member_id, member_name, plan, starts_on, ends_on, recipient, street,
                                          postal_code, city)
                values (:id, :member, :name, :plan, :starts, :ends, :recipient, :street, :postalCode, :city)
                on conflict (member_id) do update
                set member_name = excluded.member_name, plan = excluded.plan, starts_on = excluded.starts_on,
                    ends_on = excluded.ends_on, recipient = excluded.recipient, street = excluded.street,
                    postal_code = excluded.postal_code, city = excluded.city, updated_at = now()
                """)
                .param("id", UUID.randomUUID())
                .param("member", subscription.memberId())
                .param("name", subscription.memberName())
                .param("plan", subscription.plan().name())
                .param("starts", subscription.startsOn())
                .param("ends", subscription.endsOn())
                .param("recipient", address == null ? "" : address.recipient())
                .param("street", address == null ? "" : address.street())
                .param("postalCode", address == null ? "" : address.postalCode())
                .param("city", address == null ? "" : address.city())
                .update();
    }

    public void insertEvent(String memberId, String event, Plan plan, int amountCents) {
        jdbc.sql("insert into subscription_event (member_id, event, plan, amount_cents) "
                        + "values (:member, :event, :plan, :amount)")
                .param("member", memberId)
                .param("event", event)
                .param("plan", plan.name())
                .param("amount", amountCents)
                .update();
    }

    /**
     * Efface l'adresse de livraison des abonnements échus avant la date donnée (minimisation RGPD) ; l'abonnement
     * reste connu (historique, renouvellement, qui redemande une adresse pour la formule papier).
     */
    public int eraseAddressesEndedBefore(LocalDate day) {
        return jdbc.sql("""
                update subscription set recipient = '', street = '', postal_code = '', city = '', updated_at = now()
                where ends_on < :day and (recipient <> '' or street <> '' or postal_code <> '' or city <> '')
                """)
                .param("day", day)
                .update();
    }

    /** Abonnés papier actifs à la date donnée : liste d'expédition du prochain numéro. */
    public List<Subscription> findActivePaper(LocalDate day) {
        return jdbc.sql("select " + COLUMNS + " from subscription where plan = 'PAPER_DIGITAL' and ends_on >= :day "
                        + "order by postal_code, member_name")
                .param("day", day)
                .query(SubscriptionRepository::map)
                .list();
    }

    private static Subscription map(ResultSet rs, int row) throws SQLException {
        String recipient = rs.getString("recipient");
        Address address = recipient == null || recipient.isEmpty() ? null : new Address(recipient,
                rs.getString("street"), rs.getString("postal_code"), rs.getString("city"));
        return new Subscription(
                rs.getString("member_id"),
                rs.getString("member_name"),
                Plan.valueOf(rs.getString("plan")),
                rs.getObject("starts_on", LocalDate.class),
                rs.getObject("ends_on", LocalDate.class),
                address);
    }
}
