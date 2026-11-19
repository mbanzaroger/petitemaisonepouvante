import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { listerProduitsAdmin, modifierProduit, reapprovisionner } from '../../api/admin';
import { versApiError, type ApiError } from '../../api/client';
import { LIBELLES_ETAT, SEUIL_STOCK_BAS, etatStock, lireStock, type EtatStock, type NiveauStock } from '../../api/stock';
import type { Page, Product } from '../../api/types';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Pagination } from '../../components/Pagination';
import { formaterPrix } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

interface Lecture {
  produits: Page<Product>;
  niveaux: (NiveauStock | null)[];
  heure: string;
}

const formatHeure = new Intl.DateTimeFormat('fr-FR', { timeStyle: 'medium' });

interface Ligne {
  produit: Product;
  niveau: NiveauStock | null;
  etat: EtatStock;
}

/** Une ligne : réapprovisionnement et mise en vente ou retrait du produit (US18). */
function LigneProduit({ ligne, apresModification }: { ligne: Ligne; apresModification: (message: string) => void }) {
  const auth = useAuth();
  const { produit, niveau, etat } = ligne;
  const [quantite, setQuantite] = useState('10');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<ApiError>();
  const idQuantite = `quantite-${produit.id}`;

  async function ajouter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    setEnvoi(true);
    setErreur(undefined);
    try {
      const nouveau = await reapprovisionner(produit.id, Number.parseInt(quantite, 10), auth.jeton);
      apresModification(`Stock de « ${produit.name} » : ${nouveau.available} disponible${nouveau.available > 1 ? 's' : ''}.`);
    } catch (e) {
      setErreur(versApiError(e));
    } finally {
      setEnvoi(false);
    }
  }

  async function basculerVente() {
    setEnvoi(true);
    setErreur(undefined);
    try {
      const modifie = await modifierProduit(
        produit.id,
        {
          name: produit.name,
          description: produit.description ?? '',
          priceCents: produit.price.amountCents,
          category: produit.category,
          exclusive: produit.exclusive,
          active: !produit.available,
        },
        auth.jeton,
      );
      apresModification(
        modifie.available ? `« ${produit.name} » est de nouveau en vente.` : `« ${produit.name} » est retiré de la vente.`,
      );
    } catch (e) {
      setErreur(versApiError(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <tr>
      <th scope="row">
        <Link to={`/produits/${produit.id}`}>{produit.name}</Link>
        {produit.exclusive && <span className="etiquette etiquette-exclusif">Exclusivité Evil Ed</span>}
      </th>
      <td>{produit.sku}</td>
      <td>{formaterPrix(produit.price.amountCents, produit.price.currency)}</td>
      <td>{produit.available ? 'En vente' : 'Retiré'}</td>
      <td>{niveau ? niveau.available : '–'}</td>
      <td>{niveau ? niveau.reserved : '–'}</td>
      <td>
        <span className={`etat-stock etat-${etat}`}>{LIBELLES_ETAT[etat]}</span>
      </td>
      <td>
        {erreur && <MessageErreur erreur={erreur} />}
        <form className="reapprovisionnement" onSubmit={(e) => void ajouter(e)}>
          <label htmlFor={idQuantite} className="visuellement-masque">
            Quantité à ajouter au stock de {produit.name}
          </label>
          <input
            id={idQuantite}
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            required
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
          />
          <button type="submit" className="bouton bouton-secondaire" disabled={envoi}>
            Ajouter au stock{' '}
            <span className="visuellement-masque">de {produit.name}</span>
          </button>
        </form>
        <button type="button" className="bouton-lien" disabled={envoi} onClick={() => void basculerVente()}>
          {produit.available ? 'Retirer de la vente' : 'Remettre en vente'}{' '}
          <span className="visuellement-masque">: {produit.name}</span>
        </button>
      </td>
    </tr>
  );
}

/** US18 — produits du catalogue (en vente ou retirés) et leur stock : réapprovisionnement, mise en vente (ADMIN). */
export function StockPage() {
  useTitre('Produits et stock');
  const auth = useAuth();
  const [params] = useSearchParams();
  const brut = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(brut) && brut >= 1 ? brut : 1;
  const [alertesSeules, setAlertesSeules] = useState(false);
  const [message, setMessage] = useState<string>();

  const { donnees, erreur, chargement, recharger } = useRessource<Lecture>(
    `stock:${page}`,
    async (signal) => {
      const produits = await listerProduitsAdmin(page - 1, auth.jeton, signal);
      const niveaux = await Promise.all(produits.content.map((p) => lireStock(p.id, auth.jeton, signal)));
      return { produits, niveaux, heure: formatHeure.format(new Date()) };
    },
    { conserver: true },
  );

  const lignes: Ligne[] = (donnees?.produits.content ?? []).map((produit, i) => {
    const niveau = donnees?.niveaux[i] ?? null;
    return { produit, niveau, etat: etatStock(niveau) };
  });
  const enAlerte = lignes.filter((l) => l.etat !== 'correct');
  const affichees = alertesSeules ? enAlerte : lignes;

  function apresModification(texte: string) {
    setMessage(texte);
    recharger();
  }

  return (
    <>
      <h1 tabIndex={-1}>Produits et stock</h1>
      <p>
        Tous les produits du catalogue, en vente ou retirés, avec leur stock lu en direct. Ajoutez des unités pour
        réapprovisionner un produit ; le stock réservé correspond aux commandes confirmées par la saga.
      </p>
      <p>
        <Link className="bouton" to="/admin/produits/nouveau">
          Ajouter un produit
        </Link>
      </p>
      <div role="status">{message && <p className="alerte alerte-succes">{message}</p>}</div>
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

      {chargement && !donnees && <Chargement texte="Lecture des produits et du stock…" />}
      {erreur && <MessageErreur erreur={erreur} onReessayer={recharger} />}
      {donnees && (
        <>
          <p className="resultats">
            {enAlerte.length === 0
              ? `Aucun produit à surveiller sur cette page (lecture à ${donnees.heure}).`
              : `${enAlerte.length} produit${enAlerte.length > 1 ? 's' : ''} à surveiller sur cette page (lecture à ${donnees.heure}).`}
          </p>
          <div className="tableau-defilant">
            <table className="tableau">
              <caption>
                Produits et stock, page {page} sur {Math.max(1, donnees.produits.totalPages)} (seuil d'alerte :{' '}
                {SEUIL_STOCK_BAS} unités disponibles)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Produit</th>
                  <th scope="col">Référence</th>
                  <th scope="col">Prix</th>
                  <th scope="col">Vente</th>
                  <th scope="col">Disponible</th>
                  <th scope="col">Réservé</th>
                  <th scope="col">État</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {affichees.map((ligne) => (
                  <LigneProduit key={ligne.produit.id} ligne={ligne} apresModification={apresModification} />
                ))}
                {affichees.length === 0 && (
                  <tr>
                    <td colSpan={8}>Aucun produit à afficher avec ce filtre.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={donnees.produits.totalPages}
            lien={(n) => `/admin/stock?page=${n}`}
            libelle="Pages des produits"
          />
        </>
      )}
    </>
  );
}
