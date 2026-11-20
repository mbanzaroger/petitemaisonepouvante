import type { ReactNode } from 'react';

/**
 * Pictogrammes du site, dessinés pour le projet (traits de 24 × 24). Toujours décoratifs : le texte voisin ou un
 * texte masqué porte l'information (RGAA 1.2), d'où aria-hidden et focusable="false".
 */
function Icone({ children, taille = 20, plein = false }: { children: ReactNode; taille?: number; plein?: boolean }) {
  return (
    <svg
      className="icone"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill={plein ? 'currentColor' : 'none'}
      stroke={plein ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

interface Props {
  taille?: number;
}

export const IconePanier = ({ taille }: Props) => (
  <Icone taille={taille}>
    <path d="M3 9h18l-2 11H5z" />
    <path d="M8 9l3-6M16 9l-3-6M9 13v4M15 13v4" />
  </Icone>
);

export const IconeRecherche = ({ taille }: Props) => (
  <Icone taille={taille}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-4-4" />
  </Icone>
);

export const IconeCompte = ({ taille }: Props) => (
  <Icone taille={taille}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </Icone>
);

export const IconeMenu = ({ taille }: Props) => (
  <Icone taille={taille}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icone>
);

export const IconeGrille = ({ taille }: Props) => (
  <Icone taille={taille}>
    <rect x="4" y="4" width="6" height="6" />
    <rect x="14" y="4" width="6" height="6" />
    <rect x="4" y="14" width="6" height="6" />
    <rect x="14" y="14" width="6" height="6" />
  </Icone>
);

export const IconeListe = ({ taille }: Props) => (
  <Icone taille={taille}>
    <rect x="3" y="4" width="5" height="5" />
    <rect x="3" y="15" width="5" height="5" />
    <path d="M11 6h10M11 9h6M11 17h10M11 20h6" />
  </Icone>
);

export const IconeMaison = ({ taille }: Props) => (
  <Icone taille={taille}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h14V10" />
    <path d="M10 20v-5h4v5" />
  </Icone>
);

export const IconeEtoile = ({ taille }: Props) => (
  <Icone taille={taille} plein>
    <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z" />
  </Icone>
);

export const IconeFigurine = ({ taille }: Props) => (
  <Icone taille={taille}>
    <circle cx="12" cy="6" r="3" />
    <path d="M8 21v-5l-2-4 4-2h4l4 2-2 4v5" />
    <path d="M5 21h14" />
  </Icone>
);

export const IconeDisque = ({ taille }: Props) => (
  <Icone taille={taille}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
  </Icone>
);

export const IconeDe = ({ taille }: Props) => (
  <Icone taille={taille}>
    <rect x="4" y="4" width="16" height="16" rx="3" />
    <path d="M9 9h.01M15 15h.01M15 9h.01M9 15h.01M12 12h.01" />
  </Icone>
);

export const IconeTasse = ({ taille }: Props) => (
  <Icone taille={taille}>
    <path d="M4 7h12v9a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
    <path d="M16 9h2a3 3 0 0 1 0 6h-2" />
  </Icone>
);

export const IconeLivre = ({ taille }: Props) => (
  <Icone taille={taille}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
    <path d="M4 21V5M8 7h7" />
  </Icone>
);

export const IconeJournal = ({ taille }: Props) => (
  <Icone taille={taille}>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M7 8h10M7 12h4M7 16h4M14 12h3v4h-3z" />
  </Icone>
);

export const IconeEtiquette = ({ taille }: Props) => (
  <Icone taille={taille}>
    <path d="M3 12V4h8l10 10-8 8z" />
    <circle cx="7.5" cy="8.5" r="1.5" />
  </Icone>
);

export const IconeImage = ({ taille }: Props) => (
  <Icone taille={taille}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 17l-5-5-9 8" />
  </Icone>
);

/** Logo de la boutique : une maison hantée stylisée. */
export function Logo() {
  return (
    <svg className="logo" width="44" height="44" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M6 22L24 7l18 15v20H6z" fill="#ffd31a" />
      <path d="M17 42V30a7 7 0 0 1 14 0v12l-2.4-2.2-2.3 2.2-2.3-2.2-2.3 2.2-2.3-2.2z" fill="#1f1f1f" />
      <circle cx="21.5" cy="30" r="1.6" fill="#ffd31a" />
      <circle cx="26.5" cy="30" r="1.6" fill="#ffd31a" />
      <path d="M33 9h4v7l-4-3.3z" fill="#ffd31a" />
    </svg>
  );
}

const PAR_RAYON: [RegExp, (props: Props) => ReactNode][] = [
  [/figurine/i, IconeFigurine],
  [/blu-?ray|dvd|film/i, IconeDisque],
  [/jeu/i, IconeDe],
  [/goodies/i, IconeTasse],
  [/bande|bd/i, IconeLivre],
  [/fanzine/i, IconeJournal],
];

/** Pictogramme d'un rayon du catalogue (étiquette pour un rayon sans pictogramme dédié). */
export function IconeRayon({ rayon, taille }: { rayon: string; taille?: number }) {
  const Trouvee = PAR_RAYON.find(([motif]) => motif.test(rayon))?.[1] ?? IconeEtiquette;
  return <Trouvee taille={taille} />;
}
