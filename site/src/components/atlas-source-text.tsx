import { Languages, CornerDownRight } from "lucide-react";
import { useAtlas } from "./atlas-context";
import { CountryText } from "./atlas-location-badges";

const languages = new Intl.DisplayNames(["en"], { type: "language" });
export function SourceQuotation({ quote, evidenceId, recordId, claimIndex, quoteIndex }: { quote: string; evidenceId?: string; recordId?: string; claimIndex?: number; quoteIndex?: number }) {
  const { sourceText } = useAtlas();
  const text = evidenceId ? sourceText?.evidence.get(evidenceId) : sourceText?.claims.get(JSON.stringify([recordId, claimIndex, quoteIndex]));
  const translation = text?.english_translation_id ? sourceText?.translations.get(text.english_translation_id) : undefined;
  return <PairedQuotation quote={quote} language={text?.language_tag ?? "und"} translation={translation} />;
}

export function PairedQuotation({ quote, language, translation }: { quote: string; language: string; translation?: { text: string; review_status: string; origin: string } | null }) {
  const label = language === "und" ? "Language unreviewed" : language === "mul" ? "Multiple languages" : languages.of(language);
  return <div className="atlas-quotation-pair" data-translated={!!translation}>
    <div lang={language}><span className="atlas-language-badge"><Languages size={12} aria-hidden />{label}</span><blockquote><CountryText>{quote}</CountryText></blockquote></div>
    {translation && <div lang="en" className="atlas-quotation-translation"><span className="atlas-language-badge"><CornerDownRight size={12} aria-hidden />English <small>{translation.review_status === "human_approved" ? "Reviewed translation" : translation.origin === "publisher_provided" ? "Publisher translation" : "ATLAS draft"}</small></span><blockquote>{translation.text}</blockquote></div>}
  </div>;
}

export function OriginalTitle({ document }: { document: { id: string; title: string } }) {
  const { sourceText } = useAtlas();
  const row = sourceText?.titles.get(document.id);
  if (!row?.english_translation_id) return null;
  const translation = sourceText!.translations.get(row.english_translation_id)!;
  return <TranslatedTitle title={document.title} language={row.language_tag} translation={translation} />;
}

export function TranslatedTitle({ title, language, translation }: { title: string; language: string; translation: { review_status: string; origin: string } }) {
  return <details className="atlas-original-title"><summary><Languages size={13} aria-hidden />Original title · {languages.of(language)}<span>{translation.review_status === "human_approved" ? "Reviewed translation" : translation.origin === "publisher_provided" ? "Publisher translation" : "ATLAS draft"}</span></summary><p lang={language}>{title}</p></details>;
}
