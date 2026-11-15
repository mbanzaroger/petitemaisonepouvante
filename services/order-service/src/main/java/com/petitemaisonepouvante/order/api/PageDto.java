package com.petitemaisonepouvante.order.api;

import java.util.List;

/** Page de résultats : contenu et métadonnées de pagination. */
public record PageDto<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

    public static <T> PageDto<T> of(List<T> content, int page, int size, long totalElements) {
        int totalPages = (int) ((totalElements + size - 1) / size);
        return new PageDto<>(content, page, size, totalElements, totalPages);
    }
}
