package com.petitemaisonepouvante.community.notification;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.community.security.Member;

/** US11 — espace personnel du membre : notifications, préférences de notification, objets recherchés. */
@RestController
@RequestMapping("/api/v1/community")
public class NotificationController {

    private final NotificationService service;

    public NotificationController(NotificationService service) {
        this.service = service;
    }

    @GetMapping("/notifications")
    public List<Notification> notifications(JwtAuthenticationToken authentication) {
        return service.latest(Member.of(authentication));
    }

    @GetMapping("/notifications/unread-count")
    public Map<String, Long> unread(JwtAuthenticationToken authentication) {
        return Map.of("unread", service.unread(Member.of(authentication)));
    }

    @PostMapping("/notifications/read")
    public ResponseEntity<Void> markAllRead(JwtAuthenticationToken authentication) {
        service.markAllRead(Member.of(authentication));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/preferences")
    public Preferences preferences(JwtAuthenticationToken authentication) {
        return service.preferences(Member.of(authentication));
    }

    @PutMapping("/preferences")
    public Preferences savePreferences(JwtAuthenticationToken authentication,
            @Valid @RequestBody Preferences preferences) {
        return service.savePreferences(Member.of(authentication), preferences);
    }

    @GetMapping("/wishes")
    public List<Wish> wishes(JwtAuthenticationToken authentication) {
        return service.wishes(Member.of(authentication));
    }

    @PostMapping("/wishes")
    public ResponseEntity<Wish> addWish(JwtAuthenticationToken authentication,
            @Valid @RequestBody NewWishRequest request) {
        Wish wish = service.addWish(Member.of(authentication), request.keywords());
        return ResponseEntity.created(URI.create("/api/v1/community/wishes/" + wish.id())).body(wish);
    }

    @DeleteMapping("/wishes/{id}")
    public ResponseEntity<Void> removeWish(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        service.removeWish(Member.of(authentication), id);
        return ResponseEntity.noContent().build();
    }
}
