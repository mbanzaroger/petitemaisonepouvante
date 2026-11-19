package com.petitemaisonepouvante.editorial.subscription;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.editorial.security.Member;

/** US17 — formules (publiques), abonnement du membre, souscription, renouvellement ; liste d'expédition (ADMIN). */
@RestController
@RequestMapping("/api/v1/editorial")
public class SubscriptionController {

    private final SubscriptionService service;

    public SubscriptionController(SubscriptionService service) {
        this.service = service;
    }

    public record PlanDto(Plan code, String label, int priceCents, boolean paper) {
    }

    public record SubscriptionDto(boolean active, Plan plan, String planLabel, LocalDate startsOn, LocalDate endsOn,
            boolean renewable, Address address) {

        static final SubscriptionDto NONE = new SubscriptionDto(false, null, null, null, null, false, null);
    }

    public record PaperSubscriberDto(String memberName, Address address, LocalDate endsOn) {
    }

    @GetMapping("/plans")
    public List<PlanDto> plans() {
        return Arrays.stream(Plan.values()).map(p -> new PlanDto(p, p.label(), p.priceCents(), p.paper())).toList();
    }

    @GetMapping("/subscription")
    public SubscriptionDto mine(JwtAuthenticationToken authentication) {
        return service.current(Member.of(authentication).id()).map(this::dto).orElse(SubscriptionDto.NONE);
    }

    @PostMapping("/subscription")
    public ResponseEntity<SubscriptionDto> subscribe(JwtAuthenticationToken authentication,
            @Valid @RequestBody SubscriptionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(dto(service.subscribe(Member.of(authentication), request)));
    }

    @PostMapping("/subscription/renewal")
    public SubscriptionDto renew(JwtAuthenticationToken authentication, @Valid @RequestBody SubscriptionRequest request) {
        return dto(service.renew(Member.of(authentication), request));
    }

    @GetMapping("/admin/paper-subscribers")
    public List<PaperSubscriberDto> paperSubscribers() {
        return service.paperSubscribers().stream()
                .map(s -> new PaperSubscriberDto(s.memberName(), s.address(), s.endsOn())).toList();
    }

    private SubscriptionDto dto(Subscription subscription) {
        return new SubscriptionDto(subscription.activeOn(service.today()), subscription.plan(),
                subscription.plan().label(), subscription.startsOn(), subscription.endsOn(),
                service.renewable(subscription), subscription.address());
    }
}
