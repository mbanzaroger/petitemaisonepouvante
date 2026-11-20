import { createContext, useContext } from 'react';

/** Rayons du catalogue (catégories), lus une fois par le gabarit et partagés avec les pages. */
export const RayonsContexte = createContext<string[]>([]);

export function useRayons(): string[] {
  return useContext(RayonsContexte);
}

/** Présentation de chaque rayon (bandeau du catalogue), d'après l'activité de la boutique. */
const DESCRIPTIONS: Record<string, string> = {
  Figurines:
    'Figurines et bustes peints à la main, dont la gamme du collectif Evil Ed vendue en exclusivité sur le site.',
  'Blu-ray': "Films « oubliés » restaurés par Evil Ed et sélections du Petit Festival de l'Épouvante.",
  'Jeux de société': 'Jeux de plateau et de cartes pour frissonner à plusieurs, comme lors des tournois du festival.',
  Goodies: 'Mugs, t-shirts et affiches aux couleurs de la boutique et du festival.',
  'Bandes dessinées': "Albums dans l'univers des productions Evil Ed, comme la web série L'Orc.",
  Fanzine: "Le fanzine de l'horreur, du fantastique et de l'heroic fantasy, en version papier.",
};

export const DESCRIPTION_CATALOGUE =
  'Figurines, Blu-ray restaurés, jeux de société, goodies, bandes dessinées et fanzine : tout l’univers de La Petite ' +
  'Maison de l’Épouvante, comme dans nos magasins d’Angoulême, d’Aix-en-Provence, de Lyon et de Londres.';

export function descriptionRayon(rayon: string): string {
  return DESCRIPTIONS[rayon] ?? `Les produits du rayon « ${rayon} ».`;
}
