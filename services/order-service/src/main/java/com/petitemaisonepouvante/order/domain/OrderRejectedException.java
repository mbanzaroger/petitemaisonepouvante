package com.petitemaisonepouvante.order.domain;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Demande de commande valide syntaxiquement mais impossible à honorer (422). */
public class OrderRejectedException extends ErrorResponseException {

    private static final HttpStatusCode UNPROCESSABLE = HttpStatusCode.valueOf(422);

    public OrderRejectedException(String detail) {
        super(UNPROCESSABLE, ProblemDetail.forStatusAndDetail(UNPROCESSABLE, detail), null);
    }
}
