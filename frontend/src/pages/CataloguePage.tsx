import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { TAILLE_PAGE_CATALOGUE, TRIS, estTri, listerProduits, type Tri } from '../api/catalogue';
import { signalerSansAttendre } from '../api/recommandations';
import type { Product } from '../api/types';
import { useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { CarteProduit } from '../components/CarteProduit';
import { Chargement, MessageErreur } from '../components/Etats';
import { IconeEtoile, IconeGrille, IconeListe, IconeMaison, IconeRayon } from '../components/Icones';
import { ImageProduit } from '../components/ImageProduit';
import { Pagination } from '../components/Pagination';
import { Recommandations } from '../components/Recommandations';
import { DESCRIPTION_CATALOGUE, descriptionRayon, useRayons } from '../components/rayons';
import { useRecommandations } from '../hooks/useRecommandations';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

function lireNumeroPage(valeur: string | null): number {
  const page = Number.parseInt(valeur ?? '1', 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

type Vue = 'grille' | 'liste';
const CLE_VUE = 'pme.vue-catalogue';

/** Choix d'affichage mémorisé dans le navigateur (préférence de confort, rien n'est envoyé au serveur). */
function useVue(): [Vue, (vue: Vue) => void] {
  const [vue, setVue] = useState<Vue>(() => {
    try {
      return localStorage.getItem(CLE_VUE) === 'liste' ? 'liste' : 'grille';
    } catch {
      return 'grille';
    }
  });
  function choisir(suivante: Vue) {
    setVue(suivante);
    try {
      localStorage.setItem(CLE_VUE, suivante);
    } catch {
      // stockage indisponible (navigation privée) : le choix vaut pour la page en cours
    }
  }
  return [vue, choisir];
}

export function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const categorie = params.get('categorie') ?? '';
  const exclusif = params.get('exclusif') === '1';
  const recherche = (params.get('q') ?? '').trim();
  const brut = params.get('tri');
  const tri: Tri = estTri(brut) ? brut : 'nom';
  const page = lireNumeroPage(params.get('page'));
  useTitre(
    recherche
      ? `Recherche : ${recherche}`
      : categorie
        ? `Catalogue : ${categorie}`
        : exclusif
          ? 'Catalogue : exclusivités Evil Ed'
          : 'Catalogue',
  );

  const auth = useAuth();
  const rayons = useRayons();
  const produits = useRessource(`produits:${categorie}:${exclusif}:${recherche}:${tri}:${page}`, (signal) =>
    listerProduits({ page: page - 1, categorie: categorie || undefined, exclusif, recherche, tri }, signal),
  );
  const recommandations = useRecommandations();
  const personnalise = recommandations.donnees?.personalized === true;
  const [vue, choisirVue] = useVue();

  // Recherche par catégorie : signal d'intérêt, envoyé seulement si le membre a activé la personnalisation.
  useEffect(() => {
    if (personnalise && categorie) signalerSansAttendre({ kind: 'SEARCH', category: categorie }, auth.jeton);
  }, [personnalise, categorie, auth.jeton]);
  const { ajouter } = usePanier();
  const [annonce, setAnnonce] = useState('');

  function filtrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    const choix = donnees.get('categorie');
    const suivants: Record<string, string> = {};
    if (typeof choix === 'string' && choix) suivants.categorie = choix;
    if (donnees.has('exclusif')) suivants.exclusif = '1';
    if (recherche) suivants.q = recherche;
    if (tri !== 'nom') suivants.tri = tri;
    setParams(suivants);
  }

  function trier(valeur: string) {
    const suivants = new URLSearchParams(params);
    suivants.delete('page');
    if (valeur === 'nom') suivants.delete('tri');
    else suivants.set('tri', valeur);
    setParams(suivants);
  }

  function lienPage(numero: number): string {
    const suivants = new URLSearchParams(params);
    suivants.set('page', String(numero));
    return `/?${suivants.toString()}`;
  }

  const total = produits.donnees?.totalElements ?? 0;
  const contenu = produits.donnees?.content ?? [];
  const premier = (page - 1) * TAILLE_PAGE_CATALOGUE + 1;
  const sousTitre = recherche
    ? `Résultats pour « ${recherche} »`
    : categorie || (exclusif ? 'Exclusivités Evil Ed' : 'Tous les rayons');
  const presentation = recherche
    ? 'Produits dont le nom, la description ou la référence contiennent votre recherche.'
    : categorie
      ? descriptionRayon(categorie)
      : exclusif
        ? 'La gamme de figurines du collectif Evil Ed, vendue uniquement sur le site.'
        : DESCRIPTION_CATALOGUE;
  const visuel: Product | undefined = contenu.find((p) => p.imageUrl);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="fil-ariane">
        <ol>
          <li>
            <Link to="/">Accueil</Link>
          </li>
          <li aria-current="page">{sousTitre}</li>
        </ol>
      </nav>
      <div className="page-catalogue">
        <aside className="colonne-laterale" aria-label="Rayons et filtres">
          <nav className="bloc-lateral" aria-labelledby="titre-rayons">
            <h2 id="titre-rayons" className="bloc-titre">
              Rayons
            </h2>
            <ul className="liste-rayons">
              <li>
                <Link to="/" aria-current={!categorie && !exclusif && !recherche ? 'page' : undefined}>
                  <IconeMaison />
                  Tout le catalogue
                </Link>
              </li>
              {rayons.map((nom) => (
                <li key={nom}>
                  <Link
                    to={`/?categorie=${encodeURIComponent(nom)}`}
                    aria-current={categorie === nom && !recherche && !exclusif ? 'page' : undefined}
                  >
                    <IconeRayon rayon={nom} />
                    {nom}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/?exclusif=1" aria-current={exclusif && !categorie && !recherche ? 'page' : undefined}>
                  <IconeEtoile />
                  Exclusivités Evil Ed
                </Link>
              </li>
            </ul>
          </nav>
          <section className="bloc-lateral" aria-labelledby="titre-filtres">
            <h2 id="titre-filtres" className="bloc-titre">
              Filtrer par
            </h2>
            <form className="filtres" onSubmit={filtrer} aria-label="Filtrer le catalogue">
              <label htmlFor="categorie">Catégorie</label>
              <select id="categorie" name="categorie" defaultValue={categorie} key={categorie}>
                <option value="">Toutes les catégories</option>
                {rayons.map((nom) => (
                  <option key={nom} value={nom}>
                    {nom}
                  </option>
                ))}
              </select>
              <label className="case">
                <input type="checkbox" name="exclusif" defaultChecked={exclusif} key={String(exclusif)} />
                Exclusivités Evil Ed
              </label>
              <button type="submit" className="bouton">
                Filtrer
              </button>
              {(categorie || exclusif || recherche) && (
                <p className="note">
                  <Link to="/">Effacer les critères</Link>
                </p>
              )}
            </form>
          </section>
        </aside>

        <div className="colonne-principale">
          <section className="banniere-rayon" aria-labelledby="titre-catalogue">
            <div className="banniere-texte">
              <h1 id="titre-catalogue" tabIndex={-1}>
                Catalogue
              </h1>
              <p className="banniere-sous-titre">{sousTitre}</p>
              <p>{presentation}</p>
            </div>
            {visuel && (
              <div className="banniere-visuel">
                <ImageProduit produit={visuel} prioritaire />
              </div>
            )}
          </section>

          <div className="barre-catalogue">
            <div className="choix-vue" role="group" aria-label="Affichage des produits">
              <button
                type="button"
                className="bouton-vue"
                aria-pressed={vue === 'grille'}
                onClick={() => choisirVue('grille')}
              >
                <IconeGrille />
                <span className="visuellement-masque">En grille</span>
              </button>
              <button
                type="button"
                className="bouton-vue"
                aria-pressed={vue === 'liste'}
                onClick={() => choisirVue('liste')}
              >
                <IconeListe />
                <span className="visuellement-masque">En liste</span>
              </button>
            </div>
            {produits.donnees && (
              <p role="status" className="resultats">
                {total === 0 ? 'Aucun produit' : `${total} produit${total > 1 ? 's' : ''}`}
                {categorie ? ` dans la catégorie « ${categorie} »` : ''}
                {exclusif ? ' de la gamme exclusive Evil Ed' : ''}
                {recherche ? ` pour « ${recherche} »` : ''}
              </p>
            )}
            <div className="tri">
              <label htmlFor="tri">Trier par</label>
              <select id="tri" value={tri} onChange={(e) => trier(e.target.value)}>
                {Object.entries(TRIS).map(([valeur, { libelle }]) => (
                  <option key={valeur} value={valeur}>
                    {libelle}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p role="status" className="annonce">
            {annonce}
          </p>

          {produits.chargement && <Chargement texte="Chargement du catalogue…" />}
          {produits.erreur && <MessageErreur erreur={produits.erreur} onReessayer={produits.recharger} />}
          {produits.donnees && (
            <>
              {total === 0 && (recherche || categorie || exclusif) && (
                <p className="vide">
                  Essayez d'autres mots, ou <Link to="/">parcourez tout le catalogue</Link>.
                </p>
              )}
              <ul className={`grille-produits vue-${vue}`}>
                {contenu.map((produit, i) => (
                  <CarteProduit
                    key={produit.id}
                    produit={produit}
                    prioritaire={i < 3}
                    onAjouter={(choisi) => setAnnonce(ajouter(choisi, 1))}
                  />
                ))}
              </ul>
              {total > 0 && (
                <div className="pied-catalogue">
                  <p>
                    Produits {premier} à {premier + contenu.length - 1} sur {total}
                  </p>
                  <Pagination
                    page={page}
                    totalPages={produits.donnees.totalPages}
                    lien={lienPage}
                    libelle="Pages du catalogue"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <Recommandations donnees={recommandations.donnees} titre="Exclusivités et sélection de la boutique" />
    </>
  );
}
