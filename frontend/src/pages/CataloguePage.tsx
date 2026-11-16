import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listerCategories, listerProduits } from '../api/catalogue';
import { usePanier } from '../cart/contexte';
import { Chargement, MessageErreur } from '../components/Etats';
import { Pagination } from '../components/Pagination';
import { formaterPrix } from '../format';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

function lireNumeroPage(valeur: string | null): number {
  const page = Number.parseInt(valeur ?? '1', 10);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

export function CataloguePage() {
  const [params, setParams] = useSearchParams();
  const categorie = params.get('categorie') ?? '';
  const page = lireNumeroPage(params.get('page'));
  useTitre(categorie ? `Catalogue : ${categorie}` : 'Catalogue');

  const categories = useRessource('categories', listerCategories);
  const produits = useRessource(`produits:${categorie}:${page}`, (signal) =>
    listerProduits({ page: page - 1, categorie: categorie || undefined }, signal),
  );
  const { ajouter } = usePanier();
  const [annonce, setAnnonce] = useState('');

  function filtrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const choix = new FormData(evenement.currentTarget).get('categorie');
    setParams(typeof choix === 'string' && choix ? { categorie: choix } : {});
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
          </p>
          <ul className="grille-produits">
            {produits.donnees.content.map((produit) => (
              <li key={produit.id} className="carte-produit">
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
    </>
  );
}
