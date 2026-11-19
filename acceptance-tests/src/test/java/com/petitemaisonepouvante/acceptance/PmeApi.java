package com.petitemaisonepouvante.acceptance;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import java.security.cert.CertificateFactory;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Client HTTP de l'environnement testé. Configuration par variables d'environnement :
 * BASE_URL (Gateway de staging, ex. https://api.pme.local:8443) ou CATALOG_URL / ORDERS_URL / STOCK_URL / COMMUNITY_URL /
 * EDITORIAL_URL
 * (docker compose),
 * KEYCLOAK_URL, PME_CA_CERT (autorité de certification à approuver), PME_&lt;UTILISATEUR&gt;_PASSWORD.
 */
final class PmeApi {

    static final JsonMapper JSON = JsonMapper.builder().build();

    private final HttpClient http;
    private final String catalogUrl;
    private final String ordersUrl;
    private final String stockUrl;
    private final String communityUrl;
    private final String editorialUrl;
    private final String keycloakUrl;
    private final Map<String, String> tokens = new HashMap<>();

    PmeApi() {
        String base = env("BASE_URL", "http://localhost:8081");
        this.catalogUrl = env("CATALOG_URL", base);
        this.ordersUrl = env("ORDERS_URL", base);
        this.stockUrl = env("STOCK_URL", base);
        this.communityUrl = env("COMMUNITY_URL", base);
        this.editorialUrl = env("EDITORIAL_URL", base);
        this.keycloakUrl = env("KEYCLOAK_URL", "http://localhost:8080");
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).sslContext(sslContext()).build();
    }

    record Response(int status, JsonNode body, HttpResponse<String> raw) {
    }

    Response get(String service, String path, String user) {
        return send(HttpRequest.newBuilder(uri(service, path)).GET(), user);
    }

    Response post(String service, String path, String user, String json) {
        return send(HttpRequest.newBuilder(uri(service, path))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json)), user);
    }

    private URI uri(String service, String path) {
        String base = switch (service) {
            case "catalogue" -> catalogUrl;
            case "commandes" -> ordersUrl;
            case "stock" -> stockUrl;
            case "communaute" -> communityUrl;
            case "editions" -> editorialUrl;
            default -> throw new IllegalArgumentException(service);
        };
        return URI.create(base + path);
    }

    private Response send(HttpRequest.Builder request, String user) {
        if (user != null) {
            request.header("Authorization", "Bearer " + token(user));
        }
        request.header("X-Correlation-Id", "acceptance-" + System.nanoTime());
        try {
            HttpResponse<String> response = http.send(request.timeout(Duration.ofSeconds(15)).build(),
                    HttpResponse.BodyHandlers.ofString());
            JsonNode body = null;
            String text = response.body();
            if (text != null && !text.isBlank() && (text.startsWith("{") || text.startsWith("["))) {
                body = JSON.readTree(text);
            }
            return new Response(response.statusCode(), body, response);
        } catch (IOException e) {
            throw new IllegalStateException("Appel impossible : " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

    /** Jeton obtenu auprès de Keycloak avec le client de test « pme-tests » (mot de passe direct, tests uniquement). */
    String token(String user) {
        return tokens.computeIfAbsent(user, u -> {
            String password = System.getenv("PME_" + u.toUpperCase().replace('-', '_') + "_PASSWORD");
            if (password == null) {
                throw new IllegalStateException("Mot de passe absent pour " + u);
            }
            String form = "grant_type=password&client_id=pme-tests&username=" + enc(u) + "&password=" + enc(password);
            try {
                HttpResponse<String> response = http.send(HttpRequest.newBuilder(
                                URI.create(keycloakUrl + "/realms/pme/protocol/openid-connect/token"))
                        .header("Content-Type", "application/x-www-form-urlencoded")
                        .POST(HttpRequest.BodyPublishers.ofString(form)).build(),
                        HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() != 200) {
                    throw new IllegalStateException("Jeton refusé pour " + u + " : " + response.statusCode());
                }
                return JSON.readTree(response.body()).get("access_token").asString();
            } catch (IOException e) {
                throw new IllegalStateException(e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(e);
            }
        });
    }

    private static String enc(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static String env(String name, String fallback) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? fallback : value;
    }

    /** Approuve l'autorité de certification du bac à sable si PME_CA_CERT est fourni, sans désactiver la vérification TLS. */
    private static SSLContext sslContext() {
        try {
            String caPath = System.getenv("PME_CA_CERT");
            if (caPath == null || caPath.isBlank()) {
                return SSLContext.getDefault();
            }
            KeyStore trust = KeyStore.getInstance(KeyStore.getDefaultType());
            trust.load(null, null);
            try (InputStream in = Files.newInputStream(Path.of(caPath))) {
                trust.setCertificateEntry("pme-ca", CertificateFactory.getInstance("X.509").generateCertificate(in));
            }
            TrustManagerFactory factory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
            factory.init(trust);
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, factory.getTrustManagers(), null);
            return context;
        } catch (Exception e) {
            throw new IllegalStateException("Configuration TLS impossible", e);
        }
    }
}
