package com.petitemaisonepouvante.community.web;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/**
 * Erreurs de l'API au format problem+json (RFC 9457). Le détail est rédigé pour l'utilisateur : le site l'affiche
 * tel quel pour les conflits (409), les refus métier (422) et la limitation de débit (429).
 */
public final class Problems {

    private Problems() {
    }

    public static ErrorResponseException of(int status, String detail) {
        HttpStatusCode code = HttpStatusCode.valueOf(status);
        return new ErrorResponseException(code, ProblemDetail.forStatusAndDetail(code, detail), null);
    }

    public static ErrorResponseException notFound(String detail) {
        return of(404, detail);
    }

    public static ErrorResponseException forbidden(String detail) {
        return of(403, detail);
    }

    public static ErrorResponseException conflict(String detail) {
        return of(409, detail);
    }

    public static ErrorResponseException rejected(String detail) {
        return of(422, detail);
    }

    public static ErrorResponseException tooManyRequests(String detail) {
        return of(429, detail);
    }
}
