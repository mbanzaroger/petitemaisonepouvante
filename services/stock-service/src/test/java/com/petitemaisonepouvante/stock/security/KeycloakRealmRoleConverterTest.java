package com.petitemaisonepouvante.stock.security;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

class KeycloakRealmRoleConverterTest {

    private final KeycloakRealmRoleConverter converter = new KeycloakRealmRoleConverter();

    private static Jwt jwt(Map<String, Object> claims) {
        Jwt.Builder builder = Jwt.withTokenValue("jeton").header("alg", "RS256")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).subject("alice");
        claims.forEach(builder::claim);
        return builder.build();
    }

    @Test
    void convertitLesRolesDuRoyaumeEnAutorites() {
        Jwt token = jwt(Map.of("realm_access", Map.of("roles", List.of("CUSTOMER", "ADMIN"))));

        assertThat(converter.convert(token)).extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_CUSTOMER", "ROLE_ADMIN");
    }

    @Test
    void aucuneAutoriteSansRevendicationRealmAccess() {
        assertThat(converter.convert(jwt(Map.of("scope", "profile")))).isEmpty();
    }

    @Test
    void ignoreUneRevendicationMalFormee() {
        assertThat(converter.convert(jwt(Map.of("realm_access", "CUSTOMER")))).isEmpty();
        assertThat(converter.convert(jwt(Map.of("realm_access", Map.of("roles", "CUSTOMER"))))).isEmpty();
        assertThat(converter.convert(jwt(Map.of("realm_access", Map.of("roles", List.of(42, "CUSTOMER"))))))
                .extracting(GrantedAuthority::getAuthority).containsExactly("ROLE_CUSTOMER");
    }
}
