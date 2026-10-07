"use client";
import { SourceQuotation } from "./atlas-source-text";
import { useEffect, useState } from 'react';
import { CalendarDays, ChevronDown, ExternalLink, FileClock } from 'lucide-react';
import type { AtlasRelease } from '@/lib/atlas-release';
import { fetchSourceSupplement, type SourceSupplement } from '@/lib/atlas-supplement';
import { metricValue } from '@/lib/atlas-metrics';
import { formatDate } from '@/lib/atlas';
import { AtlasDisclosure } from './atlas-disclosure';
import { EvidenceSummary } from './atlas-evidence-summary';
import { CountryText } from './atlas-location-badges';
import { AtlasScope } from './atlas-scope';
import { AtlasDetailStatus } from './atlas-detail';
import { useAtlasPanelState } from './atlas-context';

export default function AtlasUndatedSources({ release }: { release: AtlasRelease }) {
  return <div className="atlas-undated-access"><AtlasScope icon={FileClock} buttonLabel="Undated sources" label="Undated sources" title="Undated sources">
    <div className="atlas-undated-sources"><SupplementContent release={release} /></div>
  </AtlasScope></div>;
}
function SupplementContent({ release }: { release: AtlasRelease }) {
  const [data, setData] = useAtlasPanelState<SourceSupplement | null>(`supplement.${release.source_supplement!.sha256}`, null);
  const [error, setError] = useState<Error>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (data) return;
    const controller = new AbortController();
    fetchSourceSupplement(release, controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(error => { if (!controller.signal.aborted) setError(error); });
    return () => controller.abort();
  }, [release, data, setData, attempt]);
  if (!data) return <AtlasDetailStatus error={error} retry={() => { setError(undefined); setAttempt(value => value + 1); }} />;
  const evidence = new Map(data.evidence.map(span => [span.id, span]));
  return <section aria-label="Undated source findings">
    {data.documents.map(doc => <AtlasDisclosure key={doc.id} open className="atlas-report atlas-undated-report" summary={<summary>
      <span className="atlas-undated-document"><FileClock size={20} aria-hidden /></span>
      <span className="atlas-report-summary"><strong>{doc.title}</strong><span>{doc.publisher}</span></span>
      <span className="atlas-expand" aria-hidden><ChevronDown size={17} /></span>
    </summary>}>{() => <div className="atlas-report-body">
      <div className="atlas-item-meta atlas-report-meta"><span><CalendarDays size={14} aria-hidden />Captured <time dateTime={doc.capture}>{formatDate(doc.capture)}</time></span><a href={doc.content_url} target="_blank" rel="noopener noreferrer">Read source <ExternalLink size={14} aria-hidden /></a></div>
      <div className="atlas-undated-context"><span className="atlas-status" data-tone="warning">Source checked · Draft</span><span>Publication date not reported</span></div>
      {data.records.filter(record => record.document_id === doc.id).map(record => <div key={record.id}>
        {record.title !== doc.title && <h3>{record.title}</h3>}
        <div className="atlas-metrics" aria-label="Undated source figures">{record.measures.map(measure => {
          const refs = [measure.source_reference, ...(measure.context_references ?? [])];
          const quotes = data.evidence.filter(span => refs.some(ref => ref.record_id === span.record_id && ref.claim_index === span.claim_index && ref.quote_indexes.includes(span.quote_index)));
          return <div className="atlas-measure" key={measure.annotation_key}>
            <strong>{metricValue(measure)}</strong><span className="atlas-measure-label">{measure.label}</span><small>{measure.period_label}</small>
            <AtlasScope label="Scope & source" title={measure.label}>
              <div className="atlas-scope-value"><strong>{metricValue(measure)}</strong><p>{measure.label}</p></div>
              <p>{measure.semantic_note}</p>
              <dl className="atlas-measure-details">{Object.entries(measure).filter(([key]) => !['annotation_key', 'label', 'value', 'semantic_note', 'evidence', 'source_reference', 'context_references', 'priority'].includes(key)).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{fieldText(value)}</dd></div>)}</dl>
              <Quotations spans={quotes} />
            </AtlasScope>
          </div>;
        })}</div>
        {record.claims.map(claim => <div className="atlas-claim" key={claim.claim_index}>
          <p><CountryText>{claim.text}</CountryText></p><AtlasDisclosure summary={<EvidenceSummary kind="quotation" count={claim.evidence_ids.length > 1 ? claim.evidence_ids.length : undefined} />}>{() => <Quotations spans={claim.evidence_ids.map(id => evidence.get(id)!)} />}</AtlasDisclosure>
        </div>)}
        <details className="atlas-measure-details"><summary>Review & disclosures</summary><p>{record.reviewed_by} · {formatDate(record.reviewed_at)}</p>{record.disclosures.map(text => <p key={text}>{text}</p>)}</details>
      </div>)}
      <details className="atlas-measure-details"><summary>Source identity</summary><dl><div><dt>Document</dt><dd>{doc.id}</dd></div><div><dt>Raw SHA-256</dt><dd>{doc.raw_sha256}</dd></div><div><dt>Text SHA-256</dt><dd>{doc.text_sha256}</dd></div><div><dt>Source URL</dt><dd><a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.url}</a></dd></div></dl></details>
      <AtlasDisclosure summary={<EvidenceSummary kind="scope" />}>{() => <><p>Outside the reporting window</p>{data.limitations.map(text => <p key={text}>{text}</p>)}</>}</AtlasDisclosure>
    </div>}</AtlasDisclosure>)}
  </section>;
}
function Quotations({ spans }: { spans: SourceSupplement['evidence'] }) {
  return <>{spans.map(span => <div key={span.id} className="atlas-undated-quotation"><small>{span.section}{span.page !== null && ` · Page ${span.page}`}</small><SourceQuotation quote={span.quote} evidenceId={span.id} /></div>)}</>;
}
function fieldText(value: unknown): string {
  if (value === null || value === undefined) return 'Not reported';
  if (Array.isArray(value)) return value.length ? value.map(fieldText).join(' · ') : 'None';
  if (typeof value === 'object' && 'value' in value && 'status' in value) return `${value.value ?? 'Not reported'} · ${String(value.status).replaceAll('_', ' ')}`;
  return String(value);
}
