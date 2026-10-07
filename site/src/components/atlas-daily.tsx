import { ArrowRight, Building2, CalendarDays, ChevronDown, Eye, FileText, MapPin, Siren, Timer, TriangleAlert, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useAtlasPanelState } from "./atlas-context";
import { sourceLogos } from "@/lib/atlas-identities";
import { CountryText, ReportCountryFlags } from "./atlas-location-badges";
import { PairedQuotation, TranslatedTitle } from "./atlas-source-text";
import { AtlasDisclosure } from "./atlas-disclosure";
import { EvidenceSummary } from "./atlas-evidence-summary";
import { formatDate } from "@/lib/atlas";
import { dailyTitle, type DailyDocument, type DailySelection, type DailyWatch } from "@/lib/atlas-daily";

const statuses = { reported: "Source reported", source_suspected: "Source suspected", source_probable: "Source probable", source_confirmed: "Source confirmed", source_ruled_out: "Source ruled out", unconfirmed: "Unconfirmed", disputed: "Disputed", unresolved: "Unresolved" };
export function DailyProcessing({ document }: { document: DailyDocument }) {
  return <span className="atlas-status atlas-daily-processing"><Timer size={12} aria-hidden />{document.processing_status === "weekly_review_pending" ? "Weekly review pending" : "Weekly reviewed"}</span>;
}
export function DailyWatchCard({ item, onReports }: { item: DailyWatch; onReports: (item: DailyWatch) => void }) {
  const AttentionIcon = item.attention === "heightened" ? TriangleAlert : item.attention === "urgent" ? Siren : Eye;
  return <article className="atlas-watch-entry atlas-daily-watch" data-daily-watch={item.id} data-attention={item.attention}>
    <div className="atlas-watch-kicker"><span><MapPin size={13} aria-hidden /><CountryText>{item.location_label}</CountryText></span>{item.development_date && <time dateTime={item.development_date}>{item.date_basis === "source_report_date" ? "Report" : "Event"} {formatDate(item.development_date)}</time>}</div>
    <h3>{item.label}</h3>
    <div className="atlas-watch-diagnosis"><strong>{item.diagnostic_label}</strong><span title="Editorial attention"><AttentionIcon size={12} aria-hidden />{item.attention === "heightened" ? "Heightened attention" : item.attention === "urgent" ? "Urgent follow-up" : "Watch"}</span></div>
    <dl className="atlas-watch-facts">{item.key_facts.map((fact, index) => <div key={index}><dt>{fact.label}</dt><dd><CountryText>{fact.text}</CountryText></dd></div>)}</dl>
    <p className="atlas-watch-why"><CountryText>{item.reason_for_attention}</CountryText></p>
    <button className="atlas-briefing-link atlas-watch-reports" onClick={() => onReports(item)}><FileText size={14} aria-hidden />View reports<ArrowRight size={14} aria-hidden /></button>
  </article>;
}
export function DailyVersion({ document, selection }: { document: DailyDocument; selection: DailySelection }) {
  return <ReportCountryFlags value={true}><section className="atlas-daily-version" aria-label={`Daily version captured ${formatDate(document.capture)}`}>
    <div className="atlas-item-meta atlas-report-meta"><span><CalendarDays size={14} aria-hidden />Captured {formatDate(document.capture)}</span><a href={document.url} target="_blank" rel="noopener noreferrer">Read source <ExternalLink size={14} aria-hidden /></a></div>
    {document.title_translation && <TranslatedTitle title={document.title} language={document.language_tag} translation={document.title_translation} />}
    {selection.findings.filter(finding => finding.document_id === document.id).map(finding => <div className="atlas-claim" key={finding.id}>
      <p><CountryText>{finding.text}</CountryText></p>
      <AtlasDisclosure summary={<EvidenceSummary kind="quotation" />}>{() => <>
        <div className="atlas-item-meta atlas-report-meta"><span>{statuses[finding.status]} · {finding.attribution.value ?? document.source_name}{finding.statement_kind !== "source_statement" && ` · ${finding.statement_kind === "analyst_hypothesis" ? "Analyst hypothesis" : "Attributed hypothesis"}`}</span>{finding.observation_period.value && <span>{finding.observation_period.value}</span>}</div>
        {finding.evidence_ids.map(id => { const evidence = selection.evidence.find(row => row.id === id)!; return <PairedQuotation key={id} quote={evidence.quote} language={evidence.language_tag} translation={evidence.translation} />; })}
      </>}</AtlasDisclosure>
    </div>)}
    {!!document.limitations.length && <AtlasDisclosure summary={<EvidenceSummary kind="scope" />}>{() => document.limitations.map(text => <p key={text}>{text}</p>)}</AtlasDisclosure>}
  </section></ReportCountryFlags>;
}
export function DailyReport({ documents, selection, highlighted }: { documents: DailyDocument[]; selection: DailySelection; highlighted: boolean }) {
  const document = documents[0];
  const logo = sourceLogos[document.source_id];
  const [open, setOpen] = useAtlasPanelState(`daily.${document.id}.open`, false);
  return <details open={open} className="atlas-report atlas-daily-report" id={`atlas-report-${document.id}`} data-evidence={highlighted} onToggle={event => { if (event.target === event.currentTarget) setOpen(event.currentTarget.open); }}>
    <summary><span className="atlas-timeline-node institution-logo atlas-source-logo">{logo ? <Image src={`/logos/atlas/${logo}`} alt={document.source_name} width={32} height={32} unoptimized /> : <Building2 size={20} aria-hidden />}</span>
      <span className="atlas-report-date">{document.publication ? formatDate(document.publication) : "Undated"}<small>{document.source_name}</small></span>
      <span className="atlas-report-summary"><strong>{dailyTitle(document)}</strong><DailyProcessing document={documents.find(doc => doc.processing_status === "weekly_review_pending") ?? document} /></span><span className="atlas-expand" aria-hidden><ChevronDown size={17} /></span></summary>
    {open && <div className="atlas-report-body atlas-daily-body">{documents.map(doc => <DailyVersion key={doc.id} document={doc} selection={selection} />)}</div>}
  </details>;
}
