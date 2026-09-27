import { AtlasScope } from "./atlas-scope";
import { EvidenceSummary } from "./atlas-evidence-summary";
import { CountryText } from "./atlas-location-badges";
import { useAtlas } from "./atlas-context";
import { BadgeCheck, CircleHelp, Copy, ExternalLink, GitBranch, Layers, TriangleAlert } from "lucide-react";
import { type Comparison } from "@/lib/atlas-comparisons";
import { metricValue } from "@/lib/atlas-metrics";
import { formatDate } from "@/lib/atlas";

const labels: Record<string, string> = {
  contradiction: "Conflicting assertions", correction: "Correction", supersession: "Superseded assertion",
  corroboration: "Independent corroboration", republication: "Repeated reporting", different_scope: "Different scope",
  unresolved_association: "Unresolved association",
};

export function ComparisonBadge({ comparison: c }: { comparison: Comparison }) {
  const Icon = c.status === "unresolved" ? TriangleAlert : c.kind === "republication" ? Copy : c.kind === "different_scope" ? Layers : GitBranch;
  return <span className="atlas-status" data-tone={c.status === "unresolved" ? "warning" : "info"}><Icon size={13} aria-hidden />{labels[c.kind]}</span>;
}

export function SourceComparisons({ recordIds, reportIds, onReport }: { recordIds: Set<string>; reportIds: string[]; onReport: (ids: string[]) => void }) {
  const { assertions, channels, atlasDocuments: documents, evidence, reportComparisons, measures } = useAtlas();
  const comparisons = reportComparisons(recordIds, reportIds);
  if (!comparisons.length) return null;
  return <div className="atlas-comparisons">{comparisons.map(c => <section key={c.id} className="atlas-comparison" data-kind={c.kind} aria-label={labels[c.kind]}>
    <header>{c.kind !== "contradiction" && <ComparisonBadge comparison={c} />}<span className="atlas-status" data-tone={c.status === "unresolved" ? "warning" : "info"}>{c.status === "unresolved" ? <CircleHelp size={13} aria-hidden /> : <BadgeCheck size={13} aria-hidden />}{c.status === "unresolved" ? "Unresolved" : "Documented"}</span><AtlasScope label="Comparison scope" title={labels[c.kind]}><div className="atlas-measure-details"><p><CountryText>{c.scope_review}</CountryText></p><small>ATLAS source review · {formatDate(c.reviewed_at)} · Editorial review pending</small></div></AtlasScope></header>
    <p className="atlas-comparison-reason"><CountryText>{c.reason}</CountryText></p>
    <div className="atlas-comparison-branches">{c.participant_ids.map(id => {
      const a = assertions.get(id)!, document = documents.get(a.document_id)!;
      const measure = a.measure_id ? measures.get(a.measure_id)! : null;
      const value = measure ? metricValue(measure) : a.kind === "date" && a.value.value ? formatDate(a.value.value) : a.value.value;
      return <div key={id} className="atlas-assertion" data-kind={a.kind}>
        <span className="atlas-assertion-section"><CountryText>{c.participant_labels[id as keyof typeof c.participant_labels]}</CountryText></span>
        {value && <strong><CountryText>{value}</CountryText>{measure && <span><CountryText>{measure.label}</CountryText></span>}</strong>}
        {!measure && <p><CountryText>{a.text}</CountryText></p>}
        {measure && <small><CountryText>{measure.geography.value}</CountryText> · <CountryText>{measure.period_label}</CountryText></small>}
        <button className="atlas-assertion-report" onClick={() => onReport([a.record_id])}>{channels.get(document.channel_id)!.name} · {formatDate(document.publication)} <ExternalLink size={12} aria-hidden /></button>
        <details className="atlas-assertion-evidence"><EvidenceSummary kind="source" />{a.evidence_ids.map((eid: string) => {
          const e = evidence.get(eid)!;
          return <div key={eid}><small><CountryText>{e.section}</CountryText>{e.page !== null && ` · page ${e.page}`}</small><blockquote><CountryText>{e.quote}</CountryText></blockquote></div>;
        })}<a href={document.content_url} target="_blank" rel="noopener noreferrer">Read source <ExternalLink size={12} aria-hidden /></a></details>
      </div>;
    })}</div>
  </section>)}</div>;
}
