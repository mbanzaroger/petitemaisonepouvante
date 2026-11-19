package com.petitemaisonepouvante.community.security;

import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Membre authentifié. L'identifiant est le « subject » du jeton Keycloak : il sert aux contrôles d'accès et n'est
 * jamais renvoyé aux autres membres, qui ne voient que le nom affiché ({@code preferred_username}).
 */
public record Member(String id, String name, boolean admin) {

    static final String DEFAULT_NAME = "membre";

    /** Membre de la requête, ou {@code null} pour un visiteur anonyme (lecture publique des annonces). */
    public static Member of(JwtAuthenticationToken authentication) {
        if (authentication == null) {
            return null;
        }
        Jwt jwt = authentication.getToken();
        String name = jwt.getClaimAsString("preferred_username");
        boolean admin = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        return new Member(jwt.getSubject(), name == null || name.isBlank() ? DEFAULT_NAME : name, admin);
    }
}
