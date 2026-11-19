import { Link, useParams } from 'react-router';
import { TYPES_ARTICLE, lireArticle } from '../../api/editions';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Paragraphes } from '../../components/Paragraphes';
import { formaterDate } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

/** US15 — lecture d'une actualité ou d'un article de fond. */
export function ArticlePage() {
  const { slug = '' } = useParams();
  const article = useRessource(`article:${slug}`, (signal) => lireArticle(slug, signal));
  const introuvable = article.erreur?.status === 404;
  useTitre(article.donnees?.title ?? (introuvable ? 'Article introuvable' : 'Article'));

  return (
    <>
      <p className="fil">
        <Link to="/actualites">Toutes les actualités</Link>
      </p>
      {article.chargement && <Chargement texte="Chargement de l'article…" />}
      {introuvable && (
        <>
          <h1 tabIndex={-1}>Article introuvable</h1>
          <p>Cet article n'existe pas ou n'est plus publié.</p>
        </>
      )}
      {article.erreur && !introuvable && <MessageErreur erreur={article.erreur} onReessayer={article.recharger} />}
      {article.donnees && (
        <article className="article">
          <p className="etiquette">{TYPES_ARTICLE[article.donnees.kind]}</p>
          <h1 tabIndex={-1}>{article.donnees.title}</h1>
          <p className="note">
            {article.donnees.author}, le {formaterDate(article.donnees.publishedAt)}
          </p>
          <p className="chapo">{article.donnees.summary}</p>
          <Paragraphes texte={article.donnees.body} />
        </article>
      )}
    </>
  );
}
