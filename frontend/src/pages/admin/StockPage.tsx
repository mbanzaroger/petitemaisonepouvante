import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listerProduits } from '../../api/catalogue';
import { LIBELLES_ETAT, SEUIL_STOCK_BAS, etatStock, lireStock, type NiveauStock } from '../../api/stock';
import type { Page, Product } from '../../api/types';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Pagination } from '../../components/Pagination';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

interface Lecture {
  produits: Page<Product>;
  niveaux: (NiveauStock | null)[];
  heure: string;
}

const formatHeure = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'medium' });

export function StockPage() {
  useTitre('Stock');
  const auth = useAuth();
  const [params] = useSearchParams();
  const brut = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(brut) && brut >= 1 ? brut : 1;
  const [alertesSeules, setAlertesSeules] = useState(false);

  const { donnees, erreur, chargement, recharger } = useRessource<Lecture>(
    `stock:${page}`,
    async (signal) => {
      const produits = await listerProduits({ page: page - 1 }, signal);
      const niveaux = await Promise.all(produits.content.map((p) => lireStock(p.id, auth.jeton, signal)));
      return { produits, niveaux, heure: formatHeure.format(new Date()) };
    },
    { conserver: true },
  );

  const lignes = (donnees?.produits.content ?? []).map((produit, i) => {
    const niveau = donnees?.niveaux[i] ?? null;
    return { produit, niveau, etat: etatStock(niveau) };
  });
  const enAlerte = lignes.filter((l) => l.etat !== 'correct');
  const affichees = alertesSeules ? enAlerte : lignes;

  return (
    <>
      <h1 tabIndex={-1}>Stock</h1>
      <p>
        Niveaux lus en direct sur le service stock pour les produits du catalogue. Le stock réservé correspond aux
        commandes confirmées par la saga.
      </p>
      <div className="barre-outils">
        <div className="case">
          <input
            id="alertes-seules"
            type="checkbox"
            checked={alertesSeules}
            onChange={(e) => setAlertesSeules(e.target.checked)}
          />
          <label htmlFor="alertes-seules">N'afficher que les produits à surveiller (stock bas, épuisé ou non suivi)</label>
        </div>
        <button type="button" className="bouton bouton-secondaire" onClick={recharger} disabled={chargement}>
          {chargement && donnees ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {chargement && !donnees && <Chargement texte="Lecture du stock…" />}
      {erreur && <MessageErreur erreur={erreur} onReessayer={recharger} />}
      {donnees && (
        <>
          <p role="status" className="resultats">
            {enAlerte.length === 0
              ? `Aucun produit à surveiller sur cette page (lecture à ${donnees.heure}).`
              : `${enAlerte.length} produit${enAlerte.length > 1 ? 's' : ''} à surveiller sur cette page (lecture à ${donnees.heure}).`}
          </p>
          <div className="tableau-defilant">
            <table className="tableau">
              <caption>
                Stock des produits du catalogue, page {page} sur {Math.max(1, donnees.produits.totalPages)} (seuil
                d'alerte : {SEUIL_STOCK_BAS} unités disponibles)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Produit</th>
                  <th scope="col">Référence</th>
                  <th scope="col">Disponible</th>
                  <th scope="col">Réservé</th>
                  <th scope="col">État</th>
                </tr>
              </thead>
              <tbody>
                {affichees.map(({ produit, niveau, etat }) => (
                  <tr key={produit.id}>
                    <th scope="row">
                      <Link to={`/produits/${produit.id}`}>{produit.name}</Link>
                    </th>
                    <td>{produit.sku}</td>
                    <td>{niveau ? niveau.available : '–'}</td>
                    <td>{niveau ? niveau.reserved : '–'}</td>
                    <td>
                      <span className={`etat-stock etat-${etat}`}>{LIBELLES_ETAT[etat]}</span>
                    </td>
                  </tr>
                ))}
                {affichees.length === 0 && (
                  <tr>
                    <td colSpan={5}>Aucun produit à afficher avec ce filtre.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={donnees.produits.totalPages}
            lien={(n) => `/admin/stock?page=${n}`}
            libelle="Pages du stock"
          />
        </>
      )}
    </>
  );
}
