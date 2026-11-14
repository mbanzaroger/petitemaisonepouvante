package com.petitemaisonepouvante.order.catalog;

import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.ErrorResponseException;

/** Le catalogue ne répond pas : la commande est refusée proprement (503) plutôt que créée avec un prix inconnu. */
public class CatalogUnavailableException extends ErrorResponseException {

    public CatalogUnavailableException(Throwable cause) {
        super(HttpStatus.SERVICE_UNAVAILABLE,
                ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE,
                        "Le catalogue est momentanément indisponible, réessayez plus tard."),
                cause);
    }
}
