package com.petitemaisonepouvante.community.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class MemberTest {

    private static JwtAuthenticationToken token(String name, String... roles) {
        Jwt.Builder jwt = Jwt.withTokenValue("jeton").header("alg", "RS256").subject("sujet-1")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60));
        if (name != null) {
            jwt.claim("preferred_username", name);
        }
        return new JwtAuthenticationToken(jwt.build(),
                List.of(roles).stream().map(role -> new SimpleGrantedAuthority("ROLE_" + role)).toList());
    }

    @Test
    void identifieLeMembreParLeSujetDuJetonEtAfficheSonNom() {
        Member member = Member.of(token("alice", "CUSTOMER"));
        assertThat(member).isEqualTo(new Member("sujet-1", "alice", false));
    }

    @Test
    void reconnaitUnAdministrateur() {
        assertThat(Member.of(token("admin-pme", "ADMIN")).admin()).isTrue();
    }

    @Test
    void utiliseUnNomParDefautSansPreferredUsername() {
        assertThat(Member.of(token(null, "CUSTOMER")).name()).isEqualTo(Member.DEFAULT_NAME);
        assertThat(Member.of(token(" ", "CUSTOMER")).name()).isEqualTo(Member.DEFAULT_NAME);
    }

    @Test
    void unVisiteurAnonymeNEstPasUnMembre() {
        assertThat(Member.of(null)).isNull();
    }
}
