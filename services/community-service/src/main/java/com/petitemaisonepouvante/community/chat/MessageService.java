package com.petitemaisonepouvante.community.chat;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.petitemaisonepouvante.community.observability.CommunityMetrics;
import com.petitemaisonepouvante.community.security.Member;
import com.petitemaisonepouvante.community.web.Problems;

/**
 * US10 — salons de discussion entre passionnés et messages des propositions. Les clients interrogent les nouveaux
 * messages périodiquement (curseur {@code after}) : pas de connexion persistante à maintenir (ADR-005).
 */
@Service
public class MessageService {

    /** Taille maximale d'une page de messages renvoyée par l'API. */
    static final int PAGE = 50;

    private final MessageRepository messages;
    private final CommunityMetrics metrics;
    private final int floodLimit;
    private final int floodWindowSeconds;

    public MessageService(MessageRepository messages, CommunityMetrics metrics,
            @Value("${pme.community.flood.max-messages:5}") int floodLimit,
            @Value("${pme.community.flood.window-seconds:10}") int floodWindowSeconds) {
        this.messages = messages;
        this.metrics = metrics;
        this.floodLimit = floodLimit;
        this.floodWindowSeconds = floodWindowSeconds;
    }

    @Transactional(readOnly = true)
    public List<Room> rooms() {
        return messages.findRooms();
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> roomMessages(String code, long after) {
        requireRoom(code);
        return messages.findInRoom(code, after, PAGE);
    }

    @Transactional(readOnly = true)
    public List<ChatMessage> offerMessages(UUID offerId, long after) {
        return messages.findInOffer(offerId, after, PAGE);
    }

    @Transactional
    public ChatMessage postInRoom(Member member, String code, String content) {
        requireRoom(code);
        throttle(member);
        ChatMessage message = messages.insertInRoom(code, member.id(), member.name(), content.strip());
        metrics.message("room");
        return message;
    }

    /** Appelé par le service des propositions, après contrôle de l'accès à la conversation. */
    @Transactional
    public ChatMessage postInOffer(Member member, UUID offerId, String content) {
        throttle(member);
        ChatMessage message = messages.insertInOffer(offerId, member.id(), member.name(), content);
        metrics.message("offer");
        return message;
    }

    private void requireRoom(String code) {
        if (!messages.roomExists(code)) {
            throw Problems.notFound("Salon introuvable");
        }
    }

    /** Anti-flood : au plus {@code floodLimit} messages par fenêtre glissante, sinon 429. */
    private void throttle(Member member) {
        if (messages.countRecentByAuthor(member.id(), floodWindowSeconds) >= floodLimit) {
            throw Problems.tooManyRequests("Vous envoyez des messages trop rapidement : patientez quelques secondes.");
        }
    }
}
