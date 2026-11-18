package com.petitemaisonepouvante.community.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Lecture publique des annonces de troc ; toute autre opération est réservée aux membres (rôle CUSTOMER ou ADMIN)
 * et la modération aux administrateurs. Jeton Keycloak vérifié par le service (signature JWKS, émetteur,
 * audience {@code pme-api}) en plus du Gateway (défense en profondeur). API sans état : ni session ni cookie.
 */
@Configuration
public class SecurityConfig {

    private static final String API = "/api/v1/community";

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoleConverter());
        return http
                // API REST sans état authentifiée par en-tête Bearer, sans cookie : pas de vecteur CSRF sur /api.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, API + "/listings/mine").hasAnyRole("CUSTOMER", "ADMIN")
                        .requestMatchers(HttpMethod.GET, API + "/listings", API + "/listings/*").permitAll()
                        .requestMatchers(API + "/moderation/**").hasRole("ADMIN")
                        .requestMatchers(API + "/**").hasAnyRole("CUSTOMER", "ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtConverter)))
                .build();
    }
}
