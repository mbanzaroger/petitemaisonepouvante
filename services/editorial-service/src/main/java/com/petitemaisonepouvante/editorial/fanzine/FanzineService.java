package com.petitemaisonepouvante.editorial.fanzine;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.editorial.observability.EditorialMetrics;
import com.petitemaisonepouvante.editorial.security.Member;
import com.petitemaisonepouvante.editorial.subscription.SubscriptionService;
import com.petitemaisonepouvante.editorial.web.Problems;

/**
 * US16 — vente des numéros numériques et lecture dans la liseuse. La première page de chaque numéro est un extrait
 * gratuit ; la suite est réservée aux membres qui ont acheté le numéro ou ont un abonnement en cours.
 */
@Service
public class FanzineService {

    static final int FREE_PAGES = 1;
    static final String NOT_FOUND = "Numéro introuvable";

    private final FanzineRepository fanzine;
    private final SubscriptionService subscriptions;
    private final EditorialMetrics metrics;

    public FanzineService(FanzineRepository fanzine, SubscriptionService subscriptions, EditorialMetrics metrics) {
        this.fanzine = fanzine;
        this.subscriptions = subscriptions;
        this.metrics = metrics;
    }

    /** Droit de lecture d'un numéro : extrait seulement, achat ou abonnement. */
    public enum Access { PREVIEW, PURCHASE, SUBSCRIPTION }

    public record IssueView(Issue issue, Access access) {
    }

    public record PageView(IssuePage page, int pageCount, Access access) {
    }

    public record LibraryItem(Issue issue, Access access, OffsetDateTime purchasedAt, int lastPage) {
    }

    @Transactional(readOnly = true)
    public List<IssueView> issues(Member member) {
        String memberId = member == null ? null : member.id();
        boolean subscribed = subscriptions.isActive(memberId);
        Map<Integer, OffsetDateTime> purchases = memberId == null ? Map.of() : fanzine.findPurchases(memberId);
        return fanzine.findIssues().stream()
                .map(issue -> new IssueView(issue, access(purchases.containsKey(issue.number()), subscribed)))
                .toList();
    }

    @Transactional(readOnly = true)
    public IssueView issue(Member member, int number) {
        Issue issue = fanzine.findIssue(number).orElseThrow(() -> Problems.notFound(NOT_FOUND));
        return new IssueView(issue, access(member, number));
    }

    @Transactional(readOnly = true)
    public List<String> tableOfContents(int number) {
        return fanzine.findPageTitles(number);
    }

    @Transactional(readOnly = true)
    public PageView read(Member member, int number, int pageNo) {
        Issue issue = fanzine.findIssue(number).orElseThrow(() -> Problems.notFound(NOT_FOUND));
        IssuePage page = fanzine.findPage(number, pageNo).orElseThrow(() -> Problems.notFound("Page introuvable"));
        Access access = access(member, number);
        if (pageNo > FREE_PAGES && access == Access.PREVIEW) {
            if (member == null) {
                throw Problems.of(401, "Connectez-vous pour lire la suite de ce numéro.");
            }
            throw Problems.forbidden("Achetez ce numéro ou abonnez-vous pour lire la suite.");
        }
        metrics.pageRead(pageNo <= FREE_PAGES && access == Access.PREVIEW ? "preview"
                : access.name().toLowerCase(java.util.Locale.ROOT));
        return new PageView(page, issue.pageCount(), access);
    }

    /** Achat simulé (démonstrateur) : le numéro rejoint la bibliothèque du membre. */
    @Transactional
    public Issue purchase(Member member, int number) {
        Issue issue = fanzine.findIssue(number).orElseThrow(() -> Problems.notFound(NOT_FOUND));
        if (fanzine.owns(member.id(), number)) {
            throw Problems.conflict("Ce numéro est déjà dans votre bibliothèque.");
        }
        if (subscriptions.isActive(member.id())) {
            throw Problems.conflict("Ce numéro est déjà inclus dans votre abonnement.");
        }
        fanzine.insertPurchase(member.id(), number, issue.priceCents());
        metrics.issuePurchased();
        return issue;
    }

    /** Bibliothèque : numéros achetés, plus tous les numéros pendant un abonnement en cours, avec la page atteinte. */
    @Transactional(readOnly = true)
    public List<LibraryItem> library(Member member) {
        boolean subscribed = subscriptions.isActive(member.id());
        Map<Integer, OffsetDateTime> purchases = fanzine.findPurchases(member.id());
        Map<Integer, Integer> progress = fanzine.findProgress(member.id());
        return fanzine.findIssues().stream()
                .filter(issue -> subscribed || purchases.containsKey(issue.number()))
                .map(issue -> new LibraryItem(issue, access(purchases.containsKey(issue.number()), subscribed),
                        purchases.get(issue.number()), progress.getOrDefault(issue.number(), 1)))
                .toList();
    }

    @Transactional
    public void saveProgress(Member member, int number, int pageNo) {
        Issue issue = fanzine.findIssue(number).orElseThrow(() -> Problems.notFound(NOT_FOUND));
        if (access(member, number) == Access.PREVIEW) {
            throw Problems.forbidden("Ce numéro n'est pas dans votre bibliothèque.");
        }
        if (pageNo < 1 || pageNo > issue.pageCount()) {
            throw Problems.rejected("Page hors du numéro.");
        }
        fanzine.saveProgress(member.id(), number, pageNo);
    }

    private Access access(Member member, int number) {
        if (member == null) {
            return Access.PREVIEW;
        }
        return access(fanzine.owns(member.id(), number), subscriptions.isActive(member.id()));
    }

    private static Access access(boolean purchased, boolean subscribed) {
        if (purchased) {
            return Access.PURCHASE;
        }
        return subscribed ? Access.SUBSCRIPTION : Access.PREVIEW;
    }
}
