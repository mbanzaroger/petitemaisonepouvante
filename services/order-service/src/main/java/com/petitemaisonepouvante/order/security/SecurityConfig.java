package com.petitemaisonepouvante.order.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * US2 : toute opération sur les commandes exige un jeton Keycloak valide (signature JWKS, émetteur,
 * audience {@code pme-api}) portant le rôle CUSTOMER. Le contrôle est fait par le service lui-même,
 * en plus du Gateway (défense en profondeur). API sans état : pas de session ni de cookie.
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
                        .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers("/api/v1/orders/admin", "/api/v1/orders/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/v1/orders", "/api/v1/orders/**").hasRole("CUSTOMER")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtConverter)))
                .build();
    }
}
