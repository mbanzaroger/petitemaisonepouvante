package com.petitemaisonepouvante.community.listing;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.community.notification.NotificationService;
import com.petitemaisonepouvante.community.security.Member;
import com.petitemaisonepouvante.community.web.PageDto;

/** US8 — annonces de troc et de dons. Lecture publique ; publication et retrait réservés aux membres. */
@RestController
@RequestMapping("/api/v1/community/listings")
public class ListingController {

    private final ListingService service;
    private final ListingRepository listings;
    private final NotificationService notifications;

    public ListingController(ListingService service, ListingRepository listings, NotificationService notifications) {
        this.service = service;
        this.listings = listings;
        this.notifications = notifications;
    }

    @GetMapping
    public PageDto<ListingDto> search(JwtAuthenticationToken authentication,
            @RequestParam(required = false) ListingType type,
            @RequestParam(required = false) Category category,
            @RequestParam(required = false) @Size(max = 60) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "12") @Min(1) @Max(50) int size) {
        Member viewer = Member.of(authentication);
        if (category != null) {
            notifications.recordBrowsing(viewer, category, 2);
        }
        List<ListingDto> content = listings.findActive(type, category, q, page, size).stream()
                .map(listing -> ListingDto.from(listing, viewer)).toList();
        return PageDto.of(content, page, size, listings.countActive(type, category, q));
    }

    @GetMapping("/mine")
    public List<ListingDto> mine(JwtAuthenticationToken authentication) {
        Member member = Member.of(authentication);
        return service.mine(member).stream().map(listing -> ListingDto.from(listing, member)).toList();
    }

    @GetMapping("/{id}")
    public ListingDto one(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        Member viewer = Member.of(authentication);
        Listing listing = service.visible(id, viewer);
        if (!listing.ownedBy(viewer)) {
            notifications.recordBrowsing(viewer, listing.category(), 1);
        }
        return ListingDto.from(listing, viewer);
    }

    @PostMapping
    public ResponseEntity<ListingDto> publish(JwtAuthenticationToken authentication,
            @Valid @RequestBody NewListingRequest request) {
        Member member = Member.of(authentication);
        Listing listing = service.publish(member, request);
        return ResponseEntity.created(URI.create("/api/v1/community/listings/" + listing.id()))
                .body(ListingDto.from(listing, member));
    }

    @PostMapping("/{id}/withdrawal")
    public ResponseEntity<Void> withdraw(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        service.withdraw(Member.of(authentication), id);
        return ResponseEntity.noContent().build();
    }
}
