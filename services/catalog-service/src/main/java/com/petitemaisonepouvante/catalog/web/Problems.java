package com.petitemaisonepouvante.catalog.web;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Erreurs de l'API au format problem+json (RFC 9457). */
public final class Problems {

    private Problems() {
    }

    public static ErrorResponseException badRequest(String detail) {
        return of(400, detail);
    }

    public static ErrorResponseException of(int status, String detail) {
        HttpStatusCode code = HttpStatusCode.valueOf(status);
        return new ErrorResponseException(code, ProblemDetail.forStatusAndDetail(code, detail), null);
    }
}
