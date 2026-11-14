package com.petitemaisonepouvante.catalog.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class CorrelationIdFilterTest {

    private final CorrelationIdFilter filter = new CorrelationIdFilter();

    @Test
    void reprendUnIdentifiantValideFourniParLeClient() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(CorrelationIdFilter.HEADER, "commande-42");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> { });

        assertThat(response.getHeader(CorrelationIdFilter.HEADER)).isEqualTo("commande-42");
    }

    @Test
    void genereUnIdentifiantQuandLEnTeteEstAbsent() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(new MockHttpServletRequest(), response, (req, res) -> { });

        assertThat(response.getHeader(CorrelationIdFilter.HEADER))
                .matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }

    @Test
    void remplaceUnIdentifiantQuiPermettraitUneInjectionDansLesLogs() {
        assertThat(CorrelationIdFilter.resolve("abc\nFAUX LOG")).isNotEqualTo("abc\nFAUX LOG").hasSize(36);
        assertThat(CorrelationIdFilter.resolve("x".repeat(65))).hasSize(36);
        assertThat(CorrelationIdFilter.resolve("")).hasSize(36);
    }

    @Test
    void exposeLIdentifiantDansLeMdcPendantLaRequetePuisLeRetire() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader(CorrelationIdFilter.HEADER, "trace-1");
        AtomicReference<String> pendant = new AtomicReference<>();

        filter.doFilter(request, new MockHttpServletResponse(),
                (req, res) -> pendant.set(MDC.get(CorrelationIdFilter.MDC_KEY)));

        assertThat(pendant.get()).isEqualTo("trace-1");
        assertThat(MDC.get(CorrelationIdFilter.MDC_KEY)).isNull();
    }
}
