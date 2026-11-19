package com.petitemaisonepouvante.community.chat;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import com.petitemaisonepouvante.community.AbstractIntegrationTest;

/** US10 — salons de discussion entre passionnés : lecture par curseur, publication, validation, anti-flood. */
class RoomApiIT extends AbstractIntegrationTest {

    private static final String ROOMS = "/api/v1/community/rooms";

    private ResultActions say(RequestPostProcessor who, String room, String content) throws Exception {
        return mvc.perform(post(ROOMS + "/{code}/messages", room).with(who)
                .contentType(MediaType.APPLICATION_JSON).content(body(Map.of("content", content))));
    }

    @Test
    @DisplayName("Les salons sont listés pour les membres uniquement")
    void salons() throws Exception {
        mvc.perform(get(ROOMS).with(member(unique("alice"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].code", is("general")))
                .andExpect(jsonPath("$[1].name", is("Films et Blu-ray")));
        mvc.perform(get(ROOMS)).andExpect(status().isUnauthorized());
        mvc.perform(get(ROOMS).with(withoutRole(unique("bob")))).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Un message publié est lu par les autres membres ; le curseur ne renvoie que les nouveaux messages")
    void publicationEtLecture() throws Exception {
        String aliceName = unique("alice");
        RequestPostProcessor alice = member(aliceName);
        RequestPostProcessor carol = member(unique("carol"));
        String texte = "Qui a vu la restauration de « Inferno » ? " + unique("m");
        String reponse = say(alice, "films", texte)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mine", is(true)))
                .andExpect(jsonPath("$.author", is(aliceName)))
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
        long id = read(reponse).get("id").asLong();

        mvc.perform(get(ROOMS + "/films/messages").with(carol))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[-1:].content", org.hamcrest.Matchers.hasItem(texte)))
                .andExpect(jsonPath("$[-1:].mine", org.hamcrest.Matchers.hasItem(false)));
        mvc.perform(get(ROOMS + "/films/messages").with(carol).param("after", Long.toString(id)))
                .andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(get(ROOMS + "/films/messages").with(carol).param("after", Long.toString(id - 1)))
                .andExpect(jsonPath("$[0].id", is((int) id)));
    }

    @Test
    @DisplayName("Salon inconnu (404), code invalide ou message vide ou trop long (400)")
    void erreurs() throws Exception {
        RequestPostProcessor alice = member(unique("alice"));
        say(alice, "inconnu", "Bonjour").andExpect(status().isNotFound());
        mvc.perform(get(ROOMS + "/inconnu/messages").with(alice)).andExpect(status().isNotFound());
        mvc.perform(get(ROOMS + "/{code}/messages", "PAS_VALIDE").with(alice)).andExpect(status().isBadRequest());
        say(alice, "general", "   ").andExpect(status().isBadRequest());
        say(alice, "general", "x".repeat(1001)).andExpect(status().isBadRequest());
        mvc.perform(get(ROOMS + "/general/messages").with(alice).param("after", "-1"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Anti-flood : au-delà de 5 messages en 10 secondes, le membre reçoit 429 avec un message explicite")
    void antiFlood() throws Exception {
        RequestPostProcessor spammeur = member(unique("spam"));
        for (int i = 0; i < 5; i++) {
            say(spammeur, "general", "Message " + i).andExpect(status().isCreated());
        }
        say(spammeur, "general", "Encore un").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.detail",
                        is("Vous envoyez des messages trop rapidement : patientez quelques secondes.")));
        say(member(unique("calme")), "general", "Bonjour à tous").andExpect(status().isCreated());
    }
}
