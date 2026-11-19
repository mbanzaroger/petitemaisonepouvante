package com.petitemaisonepouvante.editorial.fanzine;

/** Page d'un numéro : texte brut (paragraphes séparés par une ligne vide), lisible par les technologies d'assistance. */
public record IssuePage(int issueNumber, int pageNo, String title, String content) {
}
