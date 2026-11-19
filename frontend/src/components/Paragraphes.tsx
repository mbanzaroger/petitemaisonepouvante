/** Texte brut des services (paragraphes séparés par une ligne vide), affiché comme texte, jamais interprété. */
export function Paragraphes({ texte }: { texte: string }) {
  return (
    <>
      {texte
        .split(/\n\s*\n/)
        .map((paragraphe) => paragraphe.trim())
        .filter(Boolean)
        .map((paragraphe, index) => (
          <p key={index} className="texte-long">
            {paragraphe}
          </p>
        ))}
    </>
  );
}
