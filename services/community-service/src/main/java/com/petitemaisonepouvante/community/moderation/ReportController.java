package com.petitemaisonepouvante.community.moderation;

import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;

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

/** US12 — signalement (membres) et modération (rôle ADMIN, contrôlé par SecurityConfig et le Gateway). */
@RestController
@RequestMapping("/api/v1/community")
public class ReportController {

    private final ReportService service;

    public ReportController(ReportService service) {
        this.service = service;
    }

    /** 202 dans tous les cas acceptés : un second signalement du même contenu par le même membre est ignoré. */
    @PostMapping("/reports")
    public ResponseEntity<Void> report(JwtAuthenticationToken authentication,
            @Valid @RequestBody NewReportRequest request) {
        service.report(Member.of(authentication), request);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/moderation/reports")
    public List<ReportDto> reports(@RequestParam(defaultValue = "OPEN") ReportStatus status) {
        return service.reports(status).stream().map(ReportDto::from).toList();
    }

    @PostMapping("/moderation/reports/{id}/hide")
    public ResponseEntity<Void> hide(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        service.hide(Member.of(authentication), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/moderation/reports/{id}/dismiss")
    public ResponseEntity<Void> dismiss(JwtAuthenticationToken authentication, @PathVariable UUID id) {
        service.dismiss(Member.of(authentication), id);
        return ResponseEntity.noContent().build();
    }
}
