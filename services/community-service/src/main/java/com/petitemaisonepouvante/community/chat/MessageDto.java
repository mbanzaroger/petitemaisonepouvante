package com.petitemaisonepouvante.community.chat;

import java.time.OffsetDateTime;

import com.petitemaisonepouvante.community.security.Member;

/** Message tel qu'affiché : nom de l'auteur, contenu brut (échappé à l'affichage par le site), {@code mine}. */
public record MessageDto(long id, String author, String content, OffsetDateTime sentAt, boolean mine) {

    public static MessageDto from(ChatMessage message, Member viewer) {
        return new MessageDto(message.id(), message.authorName(), message.content(), message.sentAt(),
                viewer != null && message.authorId().equals(viewer.id()));
    }
}
