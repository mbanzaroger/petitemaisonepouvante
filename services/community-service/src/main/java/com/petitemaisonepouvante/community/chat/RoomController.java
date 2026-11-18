package com.petitemaisonepouvante.community.chat;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;

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

import com.petitemaisonepouvante.community.security.Member;

/** US10 — salons de discussion, réservés aux membres. */
@RestController
@RequestMapping("/api/v1/community/rooms")
public class RoomController {

    private final MessageService service;

    public RoomController(MessageService service) {
        this.service = service;
    }

    @GetMapping
    public List<Room> rooms() {
        return service.rooms();
    }

    @GetMapping("/{code}/messages")
    public List<MessageDto> messages(JwtAuthenticationToken authentication,
            @PathVariable @Pattern(regexp = "[a-z0-9-]{1,30}") String code,
            @RequestParam(defaultValue = "0") @Min(0) long after) {
        Member member = Member.of(authentication);
        return service.roomMessages(code, after).stream().map(message -> MessageDto.from(message, member)).toList();
    }

    @PostMapping("/{code}/messages")
    public ResponseEntity<MessageDto> post(JwtAuthenticationToken authentication,
            @PathVariable @Pattern(regexp = "[a-z0-9-]{1,30}") String code,
            @Valid @RequestBody NewMessageRequest request) {
        Member member = Member.of(authentication);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(MessageDto.from(service.postInRoom(member, code, request.content()), member));
    }
}
