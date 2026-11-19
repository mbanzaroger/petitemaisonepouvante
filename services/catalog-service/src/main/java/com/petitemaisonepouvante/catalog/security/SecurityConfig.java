package com.petitemaisonepouvante.catalog.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Le catalogue et les recommandations sont en lecture publique ; la personnalisation (signaux d'intérêt, consentement)
 * est réservée aux membres (CUSTOMER ou ADMIN), la gestion des produits au rôle ADMIN ; toute autre opération exige
 * un jeton Keycloak valide
 * (signature JWKS, émetteur, audience {@code pme-api}). API sans état : pas de session ni de cookie,
 * l'authentification passe uniquement par l'en-tête Authorization.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        JwtAuthenticationConverter jwtConverter = new JwtAuthenticationConverter();
        jwtConverter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoleConverter());
        return http
                // API REST sans état authentifiée par en-tête Bearer, sans cookie : pas de vecteur CSRF sur /api.
                // La protection CSRF reste active partout ailleurs.
                .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/v1/products", "/api/v1/products/*", "/api/v1/categories",
                                "/api/v1/recommendations")
                        .permitAll()
                        .requestMatchers("/api/v1/interests", "/api/v1/interests/**").hasAnyRole("CUSTOMER", "ADMIN")
                        .requestMatchers("/api/v1/catalog/admin/**").hasRole("ADMIN")
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtConverter)))
                .build();
    }
}
