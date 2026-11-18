package com.petitemaisonepouvante.community.offer;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.community.chat.MessageDto;
import com.petitemaisonepouvante.community.chat.NewMessageRequest;
import com.petitemaisonepouvante.community.security.Member;

/**
 * US9 — propositions et conversation privée. Une proposition n'est visible que de ses deux participants :
 * pour tout autre membre, elle répond 404 comme une proposition inexistante (pas d'énumération possible).
 */
@RestController
@RequestMapping("/api/v1/community")
public class OfferController {

    private final OfferService service;

    public OfferController(OfferService service) {
        this.service = service;
    }

    @PostMapping("/listings/{listingId}/offers")
    public ResponseEntity<OfferDto> make(JwtAuthenticationToken authentication, @PathVariable UUID listingId,
            @Valid @RequestBody NewOfferRequest request) {
        Member member = Member.of(authentication);
        Offer offer = service.make(member, listingId, request.message());
        return ResponseEntity.created(URI.create("/api/v1/community/offers/" + offer.id()))
                .body(OfferDto.from(offer, member));
    }

    @GetMapping("/offers")
    public OfferDto.Mine mine(JwtAuthenticationToken authentication) {
        Member member = Member.of(authentication);
        List<Offer> offers = service.involving(member);
        return new OfferDto.Mine(
                offers.stream().filter(offer -> offer.madeBy(member)).map(offer -> OfferDto.from(offer, member)).toList(),
                offers.stream().filter(offer -> offer.receivedBy(member)).map(offer -> OfferDto.from(offer, member))
                        .toList());
    }

    @GetMapping("/offers/{id}")
    public OfferDto one(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        Member member = Member.of(authentication);
        return OfferDto.from(service.get(member, id), member);
    }

    @PostMapping("/offers/{id}/acceptance")
    public OfferDto accept(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        Member member = Member.of(authentication);
        return OfferDto.from(service.accept(member, id), member);
    }

    @PostMapping("/offers/{id}/decline")
    public OfferDto decline(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        Member member = Member.of(authentication);
        return OfferDto.from(service.decline(member, id), member);
    }

    @PostMapping("/offers/{id}/cancellation")
    public OfferDto cancel(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        Member member = Member.of(authentication);
        return OfferDto.from(service.cancel(member, id), member);
    }

    @GetMapping("/offers/{id}/messages")
    public List<MessageDto> messages(JwtAuthenticationToken authentication, @PathVariable UUID id,
            @RequestParam(defaultValue = "0") @Min(0) long after) {
        Member member = Member.of(authentication);
        return service.messages(member, id, after).stream().map(message -> MessageDto.from(message, member)).toList();
    }

    @PostMapping("/offers/{id}/messages")
    public ResponseEntity<MessageDto> post(JwtAuthenticationToken authentication, @PathVariable UUID id,
            @Valid @RequestBody NewMessageRequest request) {
        Member member = Member.of(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(MessageDto.from(service.postMessage(member, id, request.content()), member));
    }
}
