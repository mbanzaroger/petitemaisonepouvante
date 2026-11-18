package com.petitemaisonepouvante.community.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.community.AbstractIntegrationTest;

/** US11 — espace personnel : préférences, objets recherchés, notifications et durées de conservation. */
class NotificationApiIT extends AbstractIntegrationTest {

    private static final String API = "/api/v1/community";

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private RetentionTask retention;

    private ResultActions addWish(RequestPostProcessor who, String keywords) throws Exception {
        return mvc.perform(post(API + "/wishes").with(who).contentType(MediaType.APPLICATION_JSON)
                .content(body(Map.of("keywords", keywords))));
    }

    @Test
    @DisplayName("Les préférences sont actives par défaut ; désactivées, aucune notification de ce type n'est créée")
    void preferences() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        mvc.perform(get(API + "/preferences").with(alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offers", is(true)))
                .andExpect(jsonPath("$.messages", is(true)))
                .andExpect(jsonPath("$.wishes", is(true)));
        mvc.perform(put(API + "/preferences").with(alice).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("offers", false, "messages", true, "wishes", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offers", is(false)));
        mvc.perform(get(API + "/preferences").with(alice)).andExpect(jsonPath("$.offers", is(false)));

        offer(member(unique("carol")), publish(alice, "Annonce sans notification"), "Intéressée !");
        assertThat(unread(alice)).isZero();

        mvc.perform(put(API + "/preferences").with(alice).contentType(MediaType.APPLICATION_JSON)
                        .content(body(Map.of("offers", true))))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Une annonce correspondant à un objet recherché prévient le membre (pas son auteur)")
    void objetsRecherches() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        RequestPostProcessor carol = member(unique("carol"));
        String motCle = unique("Evil Ed");
        String reponse = addWish(alice, "  " + motCle + "  ").andExpect(status().isCreated())
                .andExpect(jsonPath("$.keywords", is(motCle)))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        String id = read(reponse).get("id").asString();
        addWish(alice, motCle.toUpperCase()).andExpect(status().isConflict());
        addWish(carol, motCle).andExpect(status().isCreated());
        mvc.perform(get(API + "/wishes").with(alice)).andExpect(jsonPath("$", hasSize(1)));

        String annonce = publish(carol, "Figurine " + motCle.toLowerCase() + " à échanger");
        assertThat(unread(carol)).isZero();
        mvc.perform(get(API + "/notifications").with(alice))
                .andExpect(jsonPath("$[0].type", is("WISH_MATCH")))
                .andExpect(jsonPath("$[0].link", is("/communaute/annonces/" + annonce)))
                .andExpect(jsonPath("$[0].read", is(false)));

        mvc.perform(delete(API + "/wishes/{id}", id).with(carol)).andExpect(status().isNotFound());
        mvc.perform(delete(API + "/wishes/{id}", id).with(alice)).andExpect(status().isNoContent());
        mvc.perform(delete(API + "/wishes/{id}", id).with(alice)).andExpect(status().isNotFound());
        addWish(alice, "x").andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Au plus 10 objets recherchés par membre (422)")
    void limiteDesRecherches() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        for (int i = 0; i < 10; i++) {
            addWish(alice, "recherche " + i).andExpect(status().isCreated());
        }
        addWish(alice, "une de trop").andExpect(status().is(422));
    }

    @Test
    @DisplayName("Les notifications sont marquées comme lues en une fois")
    void lecture() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        offer(member(unique("carol")), publish(alice, "Annonce notifiée"), "Bonjour !");
        assertThat(unread(alice)).isEqualTo(1);
        mvc.perform(post(API + "/notifications/read").with(alice)).andExpect(status().isNoContent());
        assertThat(unread(alice)).isZero();
        mvc.perform(get(API + "/notifications").with(alice)).andExpect(jsonPath("$[0].read", is(true)));
        mvc.perform(get(API + "/notifications")).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Conservation : notifications lues de plus de 90 jours et messages de salon de plus d'un an purgés")
    void purge() {
        jdbc.update("insert into notification (member_id, type, text, link, is_read, created_at) "
                + "values ('purge-test', 'NEW_OFFER', 'ancienne', '/', true, now() - interval '100 days')");
        jdbc.update("insert into notification (member_id, type, text, link, is_read, created_at) "
                + "values ('purge-test', 'NEW_OFFER', 'non lue', '/', false, now() - interval '100 days')");
        jdbc.update("insert into message (room_code, author_id, author_name, content, sent_at) "
                + "values ('general', 'purge-test', 'purge', 'très ancien', now() - interval '400 days')");

        retention.purge();

        assertThat(jdbc.queryForObject("select count(*) from notification where member_id = 'purge-test'",
                Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from message where author_id = 'purge-test'",
                Integer.class)).isZero();
    }
}
