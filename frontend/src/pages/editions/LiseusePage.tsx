import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import { acheterNumero, enregistrerProgression, lireNumero, lirePage } from '../../api/editions';
import { estMembre, useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Paragraphes } from '../../components/Paragraphes';
import { formaterPrix } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

function LectureReservee({ numero, prix, apresAchat }: { numero: number; prix?: number; apresAchat: () => void }) {
  const auth = useAuth();
  const [erreur, setErreur] = useState<ApiError>();

  async function acheter() {
    setErreur(undefined);
    try {
      await acheterNumero(numero, auth.jeton);
      apresAchat();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  if (!auth.connecte) {
    return (
      <div className="alerte">
        <p>La suite de ce numéro est réservée aux lecteurs qui l'ont acheté ou qui sont abonnés.</p>
        <button type="button" className="bouton" onClick={auth.connecter}>
          Se connecter pour lire la suite
        </button>
      </div>
    );
  }
  return (
    <div className="alerte">
      <p>Achetez ce numéro ou abonnez-vous pour lire la suite.</p>
      {erreur && <MessageErreur erreur={erreur} />}
      <div className="actions">
        {estMembre(auth) && prix !== undefined && (
          <button type="button" className="bouton" onClick={() => void acheter()}>
            Acheter ce numéro ({formaterPrix(prix)})
          </button>
        )}
        <Link className="bouton bouton-secondaire" to="/fanzine/abonnement">
          S'abonner
        </Link>
      </div>
    </div>
  );
}

/**
 * US16 — liseuse du fanzine : une page à la fois, sommaire, pages précédente et suivante (boutons et flèches du
 * clavier). Le texte est du vrai texte (agrandissement, lecteurs d'écran) ; la page atteinte est mémorisée.
 */
export function LiseusePage() {
  const numero = Number.parseInt(useParams().numero ?? '', 10);
  const [params, setParams] = useSearchParams();
  const { state } = useLocation() as { state: { achete?: boolean } | null };
  const auth = useAuth();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const detail = useRessource(auth.pret ? `numero:${numero}:${auth.connecte}` : null, (signal) =>
    lireNumero(numero, auth.connecte ? auth.jeton : undefined, signal),
  );
  const contenu = useRessource(auth.pret ? `page:${numero}:${page}:${auth.connecte}` : null, (signal) =>
    lirePage(numero, page, auth.connecte ? auth.jeton : undefined, signal),
  );
  const titrePage = useRef<HTMLHeadingElement>(null);
  const total = detail.donnees?.contents.length ?? contenu.donnees?.pageCount ?? 1;
  useTitre(detail.donnees ? `${detail.donnees.issue.title}, page ${page}` : 'Liseuse');

  const acces = contenu.donnees?.access;
  // Mémorise la page atteinte pour « Reprendre la lecture » (membre ayant accès au numéro).
  useEffect(() => {
    if (acces && acces !== 'PREVIEW' && estMembre(auth)) {
      enregistrerProgression(numero, page, auth.jeton).catch(() => undefined);
    }
  }, [acces, numero, page, auth]);

  function aller(cible: number) {
    if (cible < 1 || cible > total) return;
    setParams({ page: String(cible) });
    titrePage.current?.focus();
  }

  // Flèches gauche et droite : page précédente ou suivante (sauf pendant une saisie ou dans le sommaire).
  const touche = useEffectEvent((evenement: KeyboardEvent) => {
    if (evenement.target instanceof HTMLElement && evenement.target.closest('select, input, textarea')) return;
    if (evenement.key === 'ArrowRight') aller(page + 1);
    if (evenement.key === 'ArrowLeft') aller(page - 1);
  });
  useEffect(() => {
    const ecouteur = (evenement: KeyboardEvent) => touche(evenement);
    window.addEventListener('keydown', ecouteur);
    return () => window.removeEventListener('keydown', ecouteur);
  }, []);

  function recharger() {
    detail.recharger();
    contenu.recharger();
  }

  const reserve = contenu.erreur && (contenu.erreur.status === 401 || contenu.erreur.status === 403);
  return (
    <div className="liseuse">
      <p className="fil">
        <Link to="/fanzine">Tous les numéros</Link>
        {estMembre(auth) && (
          <>
            {' · '}
            <Link to="/mon-espace">Ma bibliothèque</Link>
          </>
        )}
      </p>
      <h1 tabIndex={-1}>{detail.donnees?.issue.title ?? 'Liseuse'}</h1>
      {state?.achete && (
        <div role="status" className="alerte alerte-succes">
          <p>Numéro ajouté à votre bibliothèque : bonne lecture !</p>
        </div>
      )}
      {detail.erreur && <MessageErreur erreur={detail.erreur} />}
      {detail.donnees && (
        <form className="filtres" aria-label="Sommaire" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="sommaire">Aller à la page</label>
          <select id="sommaire" value={page} onChange={(e) => aller(Number(e.target.value))}>
            {detail.donnees.contents.map((titre, index) => (
              <option key={titre} value={index + 1}>
                {index + 1}. {titre}
              </option>
            ))}
          </select>
        </form>
      )}
      <section aria-labelledby="titre-page" className="page-liseuse">
        <h2 id="titre-page" tabIndex={-1} ref={titrePage}>
          Page {page} sur {total}
          {contenu.donnees ? ` : ${contenu.donnees.title}` : ''}
        </h2>
        {contenu.chargement && <Chargement texte="Chargement de la page…" />}
        {reserve && (
          <LectureReservee numero={numero} prix={detail.donnees?.issue.priceCents} apresAchat={recharger} />
        )}
        {contenu.erreur && !reserve && <MessageErreur erreur={contenu.erreur} onReessayer={contenu.recharger} />}
        {contenu.donnees && <Paragraphes texte={contenu.donnees.content} />}
      </section>
      <nav aria-label="Pages du numéro" className="actions">
        <button type="button" className="bouton bouton-secondaire" disabled={page <= 1} onClick={() => aller(page - 1)}>
          Page précédente
        </button>
        <button type="button" className="bouton" disabled={page >= total} onClick={() => aller(page + 1)}>
          Page suivante
        </button>
      </nav>
      <p className="note">Astuce : les flèches gauche et droite du clavier tournent aussi les pages.</p>
    </div>
  );
}
