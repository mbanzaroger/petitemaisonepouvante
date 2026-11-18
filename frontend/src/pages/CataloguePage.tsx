import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listerCategories, listerProduits } from '../api/catalogue';
import { signalerSansAttendre } from '../api/recommandations';
import { useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { Chargement, MessageErreur } from '../components/Etats';
import { Pagination } from '../components/Pagination';
import { Recommandations } from '../components/Recommandations';
import { formaterPrix } from '../format';
import { useRecommandations } from '../hooks/useRecommandations';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

function lireNumeroPage(valeur: string | null): number {
  const page = Number.parseInt(valeur ?? '1', 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const categorie = params.get('categorie') ?? '';
  const exclusif = params.get('exclusif') === '1';
  const page = lireNumeroPage(params.get('page'));
  useTitre(categorie ? `Catalogue : ${categorie}` : exclusif ? 'Catalogue : exclusivités Evil Ed' : 'Catalogue');

  const auth = useAuth();
  const categories = useRessource('categories', listerCategories);
  const produits = useRessource(`produits:${categorie}:${exclusif}:${page}`, (signal) =>
    listerProduits({ page: page - 1, categorie: categorie || undefined, exclusif }, signal),
  );
  const recommandations = useRecommandations();
  const personnalise = recommandations.donnees?.personalized === true;

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
    setParams(suivants);
  }

  function lienPage(numero: number): string {
    const suivants = new URLSearchParams(params);
    suivants.set('page', String(numero));
    return `/?${suivants.toString()}`;
  }

  const total = produits.donnees?.totalElements ?? 0;

  return (
    <>
      <h1 tabIndex={-1}>Catalogue</h1>
      <form className="filtres" onSubmit={filtrer} aria-label="Filtrer le catalogue">
        <label htmlFor="categorie">Catégorie</label>
        <select id="categorie" name="categorie" defaultValue={categorie} key={categorie}>
          <option value="">Toutes les catégories</option>
          {(categories.donnees ?? []).map((nom) => (
            <option key={nom} value={nom}>
              {nom}
            </option>
          ))}
        </select>
        <label className="case">
          <input type="checkbox" name="exclusif" defaultChecked={exclusif} key={String(exclusif)} />
          Exclusivités Evil Ed
        </label>
        <button type="submit" className="bouton bouton-secondaire">
          Filtrer
        </button>
      </form>

      <p role="status" className="annonce">
        {annonce}
      </p>

      {produits.chargement && <Chargement texte="Chargement du catalogue…" />}
      {produits.erreur && <MessageErreur erreur={produits.erreur} onReessayer={produits.recharger} />}
      {produits.donnees && (
        <>
          <p role="status" className="resultats">
            {total === 0 ? 'Aucun produit' : `${total} produit${total > 1 ? 's' : ''}`}
            {categorie ? ` dans la catégorie « ${categorie} »` : ''}
            {exclusif ? ' de la gamme exclusive Evil Ed' : ''}
          </p>
          <ul className="grille-produits">
            {produits.donnees.content.map((produit) => (
              <li key={produit.id} className="carte-produit">
                {produit.exclusive && <p className="etiquette etiquette-exclusif">Exclusivité Evil Ed</p>}
                <h2>
                  <Link to={`/produits/${produit.id}`}>{produit.name}</Link>
                </h2>
                <p className="categorie">{produit.category}</p>
                <p className="prix">{formaterPrix(produit.price.amountCents, produit.price.currency)}</p>
                <p className={produit.available ? 'dispo' : 'dispo dispo-non'}>
                  {produit.available ? 'Disponible' : 'Indisponible'}
                </p>
                <button
                  type="button"
                  className="bouton"
                  disabled={!produit.available}
                  onClick={() => setAnnonce(ajouter(produit, 1))}
                >
                  Ajouter{' '}
                  <span className="visuellement-masque">« {produit.name} »</span> au panier
                </button>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            totalPages={produits.donnees.totalPages}
            lien={lienPage}
            libelle="Pages du catalogue"
          />
        </>
      )}
      <Recommandations donnees={recommandations.donnees} titre="Exclusivités et sélection de la boutique" />
    </>
  );
}
