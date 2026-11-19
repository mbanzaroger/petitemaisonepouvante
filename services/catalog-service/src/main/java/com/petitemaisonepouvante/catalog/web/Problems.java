package com.petitemaisonepouvante.catalog.web;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Erreurs de l'API au format problem+json (RFC 9457). */
public final class Problems {

    private Problems() {
    }

    public static ErrorResponseException badRequest(String detail) {
        HttpStatusCode code = HttpStatusCode.valueOf(400);
        return new ErrorResponseException(code, ProblemDetail.forStatusAndDetail(code, detail), null);
    }
}
