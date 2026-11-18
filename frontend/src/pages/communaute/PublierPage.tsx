import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import {
  CATEGORIES,
  ETATS,
  publierAnnonce,
  type Categorie,
  type EtatObjet,
  type TypeAnnonce,
} from '../../api/communaute';
import { useAuth } from '../../auth/auth';
import { MessageErreur } from '../../components/Etats';
import { useTitre } from '../../hooks/useTitre';

/** US8 — publication d'une annonce d'échange ou de don (membre connecté). */
export function PublierPage() {
  useTitre('Publier une annonce');
  const auth = useAuth();
  const naviguer = useNavigate();
  const [type, setType] = useState<TypeAnnonce>('EXCHANGE');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<ApiError>();

  async function publier(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    const texte = (nom: string) => String(donnees.get(nom) ?? '').trim();
    setEnvoi(true);
    setErreur(undefined);
    try {
      const annonce = await publierAnnonce(
        {
          type,
          title: texte('titre'),
          description: texte('description'),
          category: texte('categorie') as Categorie,
          condition: texte('etat') as EtatObjet,
          wanted: type === 'EXCHANGE' && texte('contrepartie') ? texte('contrepartie') : undefined,
        },
        auth.jeton,
      );
      void naviguer(`/communaute/annonces/${annonce.id}`, { state: { publiee: true } });
    } catch (e) {
      setErreur(versApiError(e));
      setEnvoi(false);
    }
  }

  return (
    <>
      <h1 tabIndex={-1}>Publier une annonce</h1>
      <p>
        Tous les champs sont obligatoires, sauf la contrepartie. N'indiquez ni adresse, ni téléphone : vous conviendrez de
        la remise par la messagerie de la proposition.
      </p>
      <form className="formulaire" onSubmit={(e) => void publier(e)}>
        {erreur && <MessageErreur erreur={erreur} />}
        <fieldset>
          <legend>Type d'annonce</legend>
          <label className="case">
            <input type="radio" name="type" value="EXCHANGE" checked={type === 'EXCHANGE'} onChange={() => setType('EXCHANGE')} />
            Échange contre un autre objet
          </label>
          <label className="case">
            <input type="radio" name="type" value="GIFT" checked={type === 'GIFT'} onChange={() => setType('GIFT')} />
            Don gratuit
          </label>
        </fieldset>
        <label htmlFor="annonce-titre">Titre (3 à 120 caractères)</label>
        <input id="annonce-titre" name="titre" required minLength={3} maxLength={120} autoComplete="off" />
        <label htmlFor="annonce-description">Description (10 à 2 000 caractères)</label>
        <textarea id="annonce-description" name="description" required minLength={10} maxLength={2000} rows={6} />
        <label htmlFor="annonce-categorie">Catégorie</label>
        <select id="annonce-categorie" name="categorie" required defaultValue="">
          <option value="" disabled>
            Choisir une catégorie
          </option>
          {Object.entries(CATEGORIES).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
        <label htmlFor="annonce-etat">État de l'objet</label>
        <select id="annonce-etat" name="etat" required defaultValue="">
          <option value="" disabled>
            Choisir un état
          </option>
          {Object.entries(ETATS).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
        {type === 'EXCHANGE' && (
          <>
            <label htmlFor="annonce-contrepartie">Ce que vous recherchez en échange (facultatif)</label>
            <input id="annonce-contrepartie" name="contrepartie" maxLength={300} autoComplete="off" />
          </>
        )}
        <div className="actions">
          <button type="submit" className="bouton bouton-principal" disabled={envoi}>
            {envoi ? 'Publication…' : "Publier l'annonce"}
          </button>
        </div>
      </form>
    </>
  );
}
