import { CalendarDays, ExternalLink, FileText, Quote } from "lucide-react";
import type { AtlasSelectedChain } from "@/lib/atlas-contract";
import { formatDate } from "@/lib/atlas";
import { useAtlas } from "./atlas-context";
import { AtlasDetailStatus, useAtlasDetails } from "./atlas-detail";
import { AtlasConnectionCard, AtlasConnectionCards } from "./atlas-connection-cards";
import { SourceQuotation } from "./atlas-source-text";

export function ChainEvidenceCards({ chain, selected, onReport }: {
  chain: AtlasSelectedChain; selected: string; onReport: (ids: string[]) => void;
}) {
  const { atlasDocuments, channels, englishTitle } = useAtlas();
  const items = [...chain.nodes, ...chain.edges];
  const assertionIds = [...new Set(items.flatMap(item => item.assertion_ids))];
  const evidenceIds = [...new Set(items.flatMap(item => item.evidence_ids))];
  const documents = [...new Set(items.flatMap(item => item.document_ids))].map(id => atlasDocuments.get(id)!)
    .sort((a, b) => a.publication.localeCompare(b.publication) || a.id.localeCompare(b.id));
  const { data, error, retry } = useAtlasDetails([
    ...assertionIds.map(id => ({ collection: "assertions" as const, id })),
    ...evidenceIds.map(id => ({ collection: "evidence" as const, id })),
  ]);
  return <section className="atlas-chain-digests" aria-label="Journey evidence digests">
    <header className="atlas-chain-panel-heading"><h3><FileText size={14} aria-hidden />Evidence digests</h3><span>{documents.length} {documents.length === 1 ? "report" : "reports"}</span></header>
    {!data ? <AtlasDetailStatus error={error} retry={retry} /> : <AtlasConnectionCards ids={documents.map(document => document.id)} selectedId={selected} label="Evidence digests">
      {documents.map(document => {
        const statements = assertionIds.map(id => data.get("assertions", id)).filter(item => item.document_id === document.id);
        const quotes = evidenceIds.map(id => data.get("evidence", id)).filter(item => item.document_id === document.id);
        const supported = items.filter(item => item.document_ids.includes(document.id));
        const records = [...new Set(supported.flatMap(item => item.record_ids))].filter(id => document.record_ids.includes(id));
        return <AtlasConnectionCard key={document.id} id={document.id} label={englishTitle(document)} selected={supported.some(item => item.id === selected)} detailsLabel="Evidence details"
          heading={<><p className="atlas-chain-digest-source"><FileText size={12} aria-hidden />{channels.get(document.channel_id)!.name}</p><h3>{englishTitle(document)}</h3><p className="atlas-chain-digest-date"><CalendarDays size={12} aria-hidden /><time dateTime={document.publication}>{formatDate(document.publication)}</time></p></>}
          actions={<button aria-label={`View report: ${englishTitle(document)}`} title="View report" onClick={() => onReport(records)}><FileText size={14} aria-hidden /><span className="atlas-card-action-label">View report</span></button>}>
          {expanded => <><div className="atlas-card-main">
            {expanded ? statements.map(statement => <p className="atlas-chain-digest-statement" key={statement.id}>{statement.text}</p>) : <p className="atlas-card-summary">{statements.map(statement => statement.text).join(" ")}</p>}
            {expanded && <section className="atlas-chain-digest-quotes"><h4><Quote size={13} aria-hidden />Source quotations</h4>{quotes.map(quote => <SourceQuotation key={quote.id} quote={quote.quote} evidenceId={quote.id} />)}</section>}
          </div>{expanded ? <aside className="atlas-card-aside">
            <section><h4>Journey support</h4><ul className="atlas-chain-digest-links">{supported.map(item => <li key={item.id}>{"membership_basis" in item ? `Event ${chain.nodes.indexOf(item) + 1}` : `Connection ${chain.edges.indexOf(item) + 1}`} · {item.label}</li>)}</ul></section>
            <section><h4>Source report</h4><p>Published {formatDate(document.publication)} · Captured {formatDate(document.capture)}</p><a href={document.url} target="_blank" rel="noopener noreferrer">Read original report <ExternalLink size={12} aria-hidden /></a></section>
          </aside> : <div className="atlas-chain-digest-counts"><span>{statements.length} {statements.length === 1 ? "statement" : "statements"}</span><span>{quotes.length} {quotes.length === 1 ? "quotation" : "quotations"}</span></div>}</>}
        </AtlasConnectionCard>;
      })}
    </AtlasConnectionCards>}
  </section>;
}
