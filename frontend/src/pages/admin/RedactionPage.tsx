import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import { listerAbonnesPapier, publierArticle, type Article, type TypeArticle } from '../../api/editions';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { formaterJour } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

/** US15, US17 — rédaction (publication d'actualités et d'articles) et liste d'expédition du fanzine papier (ADMIN). */
export function RedactionPage() {
  useTitre('Rédaction');
  const auth = useAuth();
  const abonnes = useRessource('abonnes-papier', (signal) => listerAbonnesPapier(auth.jeton, signal));
  const [publie, setPublie] = useState<Article>();
  const [erreur, setErreur] = useState<ApiError>();

  async function publier(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const formulaire = evenement.currentTarget;
    const donnees = new FormData(formulaire);
    const champ = (nom: string) => String(donnees.get(nom) ?? '').trim();
    setErreur(undefined);
    setPublie(undefined);
    try {
      setPublie(
        await publierArticle(
          { kind: champ('type') as TypeArticle, title: champ('titre'), summary: champ('resume'), body: champ('corps') },
          auth.jeton,
        ),
      );
      formulaire.reset();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  return (
    <>
      <h1 tabIndex={-1}>Rédaction</h1>
      <section aria-labelledby="titre-publier">
        <h2 id="titre-publier">Publier une actualité ou un article</h2>
        <div role="status">
          {publie && (
            <p className="alerte alerte-succes">
              Publié : <Link to={`/actualites/${publie.slug}`}>{publie.title}</Link>
            </p>
          )}
        </div>
        <form className="formulaire" onSubmit={(e) => void publier(e)}>
          {erreur && <MessageErreur erreur={erreur} />}
          <fieldset>
            <legend>Type</legend>
            <label className="case">
              <input type="radio" name="type" value="NEWS" defaultChecked /> Actualité
            </label>
            <label className="case">
              <input type="radio" name="type" value="FEATURE" /> Article de fond
            </label>
          </fieldset>
          <label htmlFor="article-titre">Titre (5 à 160 caractères)</label>
          <input id="article-titre" name="titre" required minLength={5} maxLength={160} />
          <label htmlFor="article-resume">Résumé (10 à 300 caractères)</label>
          <textarea id="article-resume" name="resume" required minLength={10} maxLength={300} rows={2} />
          <label htmlFor="article-corps">Texte (paragraphes séparés par une ligne vide)</label>
          <textarea id="article-corps" name="corps" required minLength={20} maxLength={20000} rows={10} />
          <div className="actions">
            <button type="submit" className="bouton">
              Publier
            </button>
          </div>
        </form>
      </section>
      <section aria-labelledby="titre-expedition">
        <h2 id="titre-expedition">Abonnés papier à livrer</h2>
        {abonnes.chargement && <Chargement texte="Chargement des abonnés…" />}
        {abonnes.erreur && <MessageErreur erreur={abonnes.erreur} onReessayer={abonnes.recharger} />}
        {abonnes.donnees && abonnes.donnees.length === 0 && <p>Aucun abonné papier en cours.</p>}
        {abonnes.donnees && abonnes.donnees.length > 0 && (
          <div className="tableau-defilant">
            <table className="tableau">
              <caption>Liste d'expédition du prochain numéro</caption>
              <thead>
                <tr>
                  <th scope="col">Membre</th>
                  <th scope="col">Destinataire et adresse</th>
                  <th scope="col">Échéance</th>
                </tr>
              </thead>
              <tbody>
                {abonnes.donnees.map((abonne) => (
                  <tr key={abonne.memberName}>
                    <th scope="row">{abonne.memberName}</th>
                    <td>
                      {abonne.address.recipient}, {abonne.address.street}, {abonne.address.postalCode}{' '}
                      {abonne.address.city}
                    </td>
                    <td>{formaterJour(abonne.endsOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
