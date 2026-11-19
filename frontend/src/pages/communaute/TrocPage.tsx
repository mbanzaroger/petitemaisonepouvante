import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  CATEGORIES,
  ETATS,
  TYPES,
  listerAnnonces,
  type Categorie,
  type TypeAnnonce,
} from '../../api/communaute';
import { estMembre, useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Pagination } from '../../components/Pagination';
import { formaterDate } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

function parmi<T extends string>(valeur: string | null, liste: Record<T, string>): T | undefined {
  return valeur !== null && Object.hasOwn(liste, valeur) ? (valeur as T) : undefined;
}

function lireNumeroPage(valeur: string | null): number {
  const page = Number.parseInt(valeur ?? '1', 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** US8 — annonces de troc et de dons entre particuliers (lecture publique, filtres, recherche). */
export function TrocPage() {
  useTitre('Troc et dons');
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const type = parmi<TypeAnnonce>(params.get('type'), TYPES);
  const categorie = parmi<Categorie>(params.get('categorie'), CATEGORIES);
  const recherche = (params.get('q') ?? '').slice(0, 60);
  const page = lireNumeroPage(params.get('page'));

  const annonces = useRessource(
    auth.pret ? `annonces:${type ?? ''}:${categorie ?? ''}:${recherche}:${page}:${auth.connecte}` : null,
    (signal) =>
      listerAnnonces(
        { type, category: categorie, q: recherche || undefined, page: page - 1 },
        auth.connecte ? auth.jeton : undefined,
        signal,
      ),
  );

  function filtrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    const suivants = new URLSearchParams();
    for (const nom of ['type', 'categorie', 'q']) {
      const valeur = String(donnees.get(nom) ?? '').trim();
      if (valeur) suivants.set(nom, valeur);
    }
    setParams(suivants);
  }

  function lienPage(numero: number): string {
    const suivants = new URLSearchParams(params);
    suivants.set('page', String(numero));
    return `/communaute?${suivants.toString()}`;
  }

  const total = annonces.donnees?.totalElements ?? 0;
  return (
    <>
      <h1 tabIndex={-1}>Troc et dons</h1>
      <p>
        Échangez ou donnez vos objets de collection entre passionnés. Les annonces sont modérées : pas de vente, pas de
        coordonnées personnelles dans les textes.
      </p>
      <div className="barre-outils">
        <ul className="liens-rapides">
          <li>
            <Link to="/communaute/propositions">Mes propositions</Link>
          </li>
          <li>
            <Link to="/communaute/salons">Salons de discussion</Link>
          </li>
        </ul>
        {estMembre(auth) && (
          <Link className="bouton" to="/communaute/publier">
            Publier une annonce
          </Link>
        )}
        {auth.pret && !auth.connecte && (
          <button type="button" className="bouton bouton-secondaire" onClick={auth.connecter}>
            Se connecter pour publier
          </button>
        )}
      </div>

      <form className="filtres" onSubmit={filtrer} aria-label="Filtrer les annonces" key={params.toString()}>
        <label htmlFor="filtre-type">Type</label>
        <select id="filtre-type" name="type" defaultValue={type ?? ''}>
          <option value="">Échanges et dons</option>
          {Object.entries(TYPES).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
        <label htmlFor="filtre-categorie">Catégorie</label>
        <select id="filtre-categorie" name="categorie" defaultValue={categorie ?? ''}>
          <option value="">Toutes les catégories</option>
          {Object.entries(CATEGORIES).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
        <label htmlFor="filtre-q">Rechercher</label>
        <input id="filtre-q" name="q" type="search" maxLength={60} defaultValue={recherche} />
        <button type="submit" className="bouton bouton-secondaire">
          Filtrer
        </button>
      </form>

      {annonces.chargement && <Chargement texte="Chargement des annonces…" />}
      {annonces.erreur && <MessageErreur erreur={annonces.erreur} onReessayer={annonces.recharger} />}
      {annonces.donnees && (
        <>
          <p role="status" className="resultats">
            {total === 0 ? 'Aucune annonce' : `${total} annonce${total > 1 ? 's' : ''}`}
          </p>
          <ul className="grille-produits">
            {annonces.donnees.content.map((annonce) => (
              <li key={annonce.id} className="carte-produit carte-annonce">
                <p className={`etiquette etiquette-${annonce.type.toLowerCase()}`}>{TYPES[annonce.type]}</p>
                <h2>
                  <Link to={`/communaute/annonces/${annonce.id}`}>{annonce.title}</Link>
                </h2>
                <p className="categorie">
                  {CATEGORIES[annonce.category]} · {ETATS[annonce.condition]}
                </p>
                {annonce.wanted && <p>Recherche en échange : {annonce.wanted}</p>}
                <p className="note">
                  {annonce.mine ? 'Votre annonce' : `Proposée par ${annonce.ownerName}`}, le{' '}
                  {formaterDate(annonce.createdAt)}
                </p>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={annonces.donnees.totalPages}
            lien={lienPage}
            libelle="Pages des annonces"
          />
        </>
      )}
    </>
  );
}
