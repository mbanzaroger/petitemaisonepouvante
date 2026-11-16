import { Link } from 'react-router';

interface Props {
  /** Page courante, numérotée à partir de 1. */
  page: number;
  totalPages: number;
  lien: (page: number) => string;
  libelle?: string;
}

export function Pagination({ page, totalPages, lien, libelle = 'Pagination' }: Props) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={libelle} className="pagination">
      <ul>
        <li>
          {page > 1 ? (
            <Link to={lien(page - 1)} rel="prev">
              Page précédente
            </Link>
          ) : (
            <span className="pagination-inactif">Page précédente</span>
          )}
        </li>
        <li aria-current="page">
          Page {page} sur {totalPages}
        </li>
        <li>
          {page < totalPages ? (
            <Link to={lien(page + 1)} rel="next">
              Page suivante
            </Link>
          ) : (
            <span className="pagination-inactif">Page suivante</span>
          )}
        </li>
      </ul>
    </nav>
  );
}
