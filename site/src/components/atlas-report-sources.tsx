import type { AtlasDocument, AtlasComparison } from "@/lib/atlas-contract";
import { groupVersionReviews, type groupReportClaims } from "@/lib/atlas-report-details";
import { useAtlas } from "./atlas-context";
import { AtlasDisclosure } from "./atlas-disclosure";
import { EvidenceSummary } from "./atlas-evidence-summary";
import { SourceQuotation } from "./atlas-source-text";
import { CountryText } from "./atlas-location-badges";
import { AtlasScope } from "./atlas-scope";
import { ExternalLink } from "lucide-react";
import { formatDate } from "@/lib/atlas";

const captured = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "medium" });
export function SourceVersionLink({ document }: { document: Pick<AtlasDocument, "id" | "capture" | "url"> }) {
  return <a href={document.url} target="_blank" rel="noopener noreferrer" data-source-version={document.id}>Captured <time dateTime={document.capture}>{captured.format(new Date(document.capture))}</time><ExternalLink size={12} aria-hidden /></a>;
}

export function ReportSourceVersions({ documents, comparisons }: { documents: AtlasDocument[]; comparisons: AtlasComparison[] }) {
  if (documents.length < 2) return null;
  return <AtlasDisclosure className="atlas-source-versions" summary={<EvidenceSummary kind="versions" count={documents.length} />}>{() => <>
    <div className="atlas-source-references">{documents.map(document => <SourceVersionLink key={document.id} document={document} />)}</div>
    {groupVersionReviews(comparisons).map(group => {
      const c = group[0];
      return <section className="atlas-version-review" key={c.id} data-comparison-ids={group.map(row => row.id).join(" ")}>
        <p><CountryText>{c.reason}</CountryText></p>
        <AtlasScope label="Comparison scope" title="Source versions"><div className="atlas-measure-details"><p><CountryText>{c.scope_review}</CountryText></p>{c.independence && <p>{c.independence}</p>}<small>ATLAS source review · {formatDate(c.reviewed_at)} · {group.length} finding comparisons</small></div></AtlasScope>
      </section>;
    })}
  </>}</AtlasDisclosure>;
}

export function ReportClaimEvidence({ references }: { references: ReturnType<typeof groupReportClaims>[number] }) {
  const { atlasDocuments, sourceText } = useAtlas();
  const quotations = new Map<string, { quote: string; quoteIndex: number; references: typeof references }>();
  for (const ref of references) ref.claim.quotes.forEach((quote, quoteIndex) => {
    const text = sourceText?.claims.get(JSON.stringify([ref.record.id, ref.claim.claim_index, quoteIndex]));
    const translation = text?.english_translation_id ? sourceText?.translations.get(text.english_translation_id) : undefined;
    const key = JSON.stringify([quote, text?.language_tag, translation?.text, translation?.review_status, translation?.origin]);
    const group = quotations.get(key) ?? { quote, quoteIndex, references: [] };
    group.references.push(ref); quotations.set(key, group);
  });
  return [...quotations].map(([key, group]) => {
    const { record, claim } = group.references[0];
    const documents = [...new Set(group.references.map(ref => ref.record.document_id))].map(id => atlasDocuments.get(id)!);
    return <div key={key}><SourceQuotation quote={group.quote} recordId={record.id} claimIndex={claim.claim_index} quoteIndex={group.quoteIndex} />
      {references.length > 1 && <div className="atlas-source-references">{documents.map(document => <SourceVersionLink key={document.id} document={document} />)}</div>}
    </div>;
  });
}
