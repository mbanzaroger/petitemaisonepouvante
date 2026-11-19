import { Link, useSearchParams } from 'react-router';
import { TYPES_ARTICLE, listerArticles, type TypeArticle } from '../../api/editions';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Pagination } from '../../components/Pagination';
import { formaterDate } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

const FILTRES: { valeur: TypeArticle | ''; libelle: string }[] = [
  { valeur: '', libelle: 'Tout' },
  { valeur: 'NEWS', libelle: 'Actualités' },
  { valeur: 'FEATURE', libelle: 'Articles de fond' },
];

/** US15 — actualités de la boutique et du festival, articles de fond : en accès libre. */
export function ActualitesPage() {
  useTitre('Actualités et articles');
  const [params] = useSearchParams();
  const type = params.get('type') === 'NEWS' || params.get('type') === 'FEATURE' ? (params.get('type') as TypeArticle) : undefined;
  const numero = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const articles = useRessource(`articles:${type ?? ''}:${numero}`, (signal) => listerArticles(type, numero - 1, signal));

  return (
    <>
      <h1 tabIndex={-1}>Actualités et articles</h1>
      <nav aria-label="Type d'articles">
        <ul className="liens-rapides">
          {FILTRES.map(({ valeur, libelle }) => (
            <li key={libelle}>
              <Link to={valeur ? `/actualites?type=${valeur}` : '/actualites'} aria-current={(type ?? '') === valeur ? 'page' : undefined}>
                {libelle}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {articles.chargement && <Chargement texte="Chargement des articles…" />}
      {articles.erreur && <MessageErreur erreur={articles.erreur} onReessayer={articles.recharger} />}
      {articles.donnees && articles.donnees.content.length === 0 && <p>Aucun article pour le moment.</p>}
      {articles.donnees && (
        <>
          <ul className="liste-articles">
            {articles.donnees.content.map((article) => (
              <li key={article.id} className="carte-article">
                <p className="etiquette">{TYPES_ARTICLE[article.kind]}</p>
                <h2>
                  <Link to={`/actualites/${article.slug}`}>{article.title}</Link>
                </h2>
                <p>{article.summary}</p>
                <p className="note">
                  {article.author}, le {formaterDate(article.publishedAt)}
                </p>
              </li>
            ))}
          </ul>
          <Pagination
            page={numero}
            totalPages={articles.donnees.totalPages}
            lien={(n) => `/actualites?${new URLSearchParams({ ...(type ? { type } : {}), page: String(n) }).toString()}`}
            libelle="Pages des articles"
          />
        </>
      )}
    </>
  );
}
