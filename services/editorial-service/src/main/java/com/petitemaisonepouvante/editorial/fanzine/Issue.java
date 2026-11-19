package com.petitemaisonepouvante.editorial.fanzine;

import java.time.LocalDate;

/** Numéro du fanzine disponible en version numérique (prix en centimes). */
public record Issue(int number, String title, String summary, LocalDate publishedOn, int priceCents, int pageCount) {
}
