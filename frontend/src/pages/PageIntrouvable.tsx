import { Link } from 'react-router';
import { useTitre } from '../hooks/useTitre';

export function PageIntrouvable() {
  useTitre('Page introuvable');
  return (
    <>
      <h1 tabIndex={-1}>Page introuvable</h1>
      <p>Cette page n'existe pas ou a été déplacée.</p>
      <p>
        <Link to="/">Retour au catalogue</Link>
      </p>
    </>
  );
}
