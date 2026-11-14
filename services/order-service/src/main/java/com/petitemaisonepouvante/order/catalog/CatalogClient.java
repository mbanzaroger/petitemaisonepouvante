package com.petitemaisonepouvante.order.catalog;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.petitemaisonepouvante.order.web.CorrelationIdFilter;

/**
 * Client REST de catalog-service : relit prix et disponibilité côté serveur (le prix n'est jamais accepté du client).
 * Délais courts et explicites pour qu'une lenteur du catalogue ne bloque pas les threads de order-service.
 */
@Component
public class CatalogClient {

    private final RestClient rest;

    public CatalogClient(RestClient.Builder builder,
            @Value("${pme.catalog.url}") String baseUrl,
            @Value("${pme.catalog.timeout:3s}") Duration timeout) {
        JdkClientHttpRequestFactory requestFactory =
                new JdkClientHttpRequestFactory(HttpClient.newBuilder().connectTimeout(timeout).build());
        requestFactory.setReadTimeout(timeout);
        this.rest = builder.baseUrl(baseUrl).requestFactory(requestFactory).build();
    }

    public List<CatalogProduct> findByIds(Collection<UUID> ids) {
        String joined = ids.stream().map(UUID::toString).collect(Collectors.joining(","));
        try {
            CatalogProduct[] products = rest.get()
                    .uri(uri -> uri.path("/api/v1/products").queryParam("ids", joined).build())
                    .headers(headers -> {
                        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
                        if (correlationId != null) {
                            headers.set(CorrelationIdFilter.HEADER, correlationId);
                        }
                    })
                    .retrieve()
                    .body(CatalogProduct[].class);
            return products == null ? List.of() : List.of(products);
        } catch (RestClientException e) {
            throw new CatalogUnavailableException(e);
        }
    }
}
