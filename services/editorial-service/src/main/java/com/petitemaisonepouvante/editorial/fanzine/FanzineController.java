package com.petitemaisonepouvante.editorial.fanzine;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.petitemaisonepouvante.editorial.security.Member;

/** US16 — numéros du fanzine (sommaire public), lecture page par page, achat, bibliothèque et progression. */
@RestController
@RequestMapping("/api/v1/editorial")
public class FanzineController {

    private final FanzineService service;

    public FanzineController(FanzineService service) {
        this.service = service;
    }

    public record IssueDto(int number, String title, String summary, LocalDate publishedOn, int priceCents,
            int pageCount, FanzineService.Access access) {

        static IssueDto from(FanzineService.IssueView view) {
            Issue issue = view.issue();
            return new IssueDto(issue.number(), issue.title(), issue.summary(), issue.publishedOn(),
                    issue.priceCents(), issue.pageCount(), view.access());
        }
    }

    public record IssueDetailDto(IssueDto issue, List<String> contents) {
    }

    public record PageDto(int issueNumber, int pageNo, int pageCount, String title, String content,
            FanzineService.Access access) {
    }

    public record LibraryItemDto(IssueDto issue, OffsetDateTime purchasedAt, int lastPage) {
    }

    public record ProgressRequest(@NotNull @Min(1) @Max(500) Integer page) {
    }

    @GetMapping("/issues")
    public List<IssueDto> issues(JwtAuthenticationToken authentication) {
        return service.issues(Member.of(authentication)).stream().map(IssueDto::from).toList();
    }

    @GetMapping("/issues/{number}")
    public IssueDetailDto issue(JwtAuthenticationToken authentication, @PathVariable @Min(1) int number) {
        return new IssueDetailDto(IssueDto.from(service.issue(Member.of(authentication), number)),
                service.tableOfContents(number));
    }

    @GetMapping("/issues/{number}/pages/{page}")
    public PageDto page(JwtAuthenticationToken authentication, @PathVariable @Min(1) int number,
            @PathVariable @Min(1) @Max(500) int page) {
        FanzineService.PageView view = service.read(Member.of(authentication), number, page);
        return new PageDto(number, page, view.pageCount(), view.page().title(), view.page().content(), view.access());
    }

    @PostMapping("/issues/{number}/purchase")
    public ResponseEntity<IssueDto> purchase(JwtAuthenticationToken authentication, @PathVariable @Min(1) int number) {
        Member member = Member.of(authentication);
        Issue issue = service.purchase(member, number);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(IssueDto.from(new FanzineService.IssueView(issue, FanzineService.Access.PURCHASE)));
    }

    @GetMapping("/library")
    public List<LibraryItemDto> library(JwtAuthenticationToken authentication) {
        return service.library(Member.of(authentication)).stream()
                .map(item -> new LibraryItemDto(IssueDto.from(new FanzineService.IssueView(item.issue(), item.access())),
                        item.purchasedAt(), item.lastPage()))
                .toList();
    }

    @PutMapping("/library/{number}/progress")
    public ResponseEntity<Void> progress(JwtAuthenticationToken authentication, @PathVariable @Min(1) int number,
            @Valid @RequestBody ProgressRequest request) {
        service.saveProgress(Member.of(authentication), number, request.page());
        return ResponseEntity.noContent().build();
    }
}
