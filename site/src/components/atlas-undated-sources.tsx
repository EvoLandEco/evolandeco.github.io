"use client";
import { SourceQuotation } from "./atlas-source-text";
import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ExternalLink, FileClock, Search } from 'lucide-react';
import type { AtlasRelease } from '@/lib/atlas-release';
import { fetchSourceSupplement, type SourceSupplement } from '@/lib/atlas-supplement';
import { createSupplementComponentStore, fetchSupplementCollection, type SupplementCatalogue } from '@/lib/atlas-supplement-collection';
import { metricValue } from '@/lib/atlas-metrics';
import { formatDate } from '@/lib/atlas';
import { AtlasDisclosure } from './atlas-disclosure';
import { EvidenceSummary } from './atlas-evidence-summary';
import { CountryText } from './atlas-location-badges';
import { AtlasScope } from './atlas-scope';
import { AtlasDetailStatus } from './atlas-detail';
import { AtlasSelect } from './atlas-select';

export default function AtlasUndatedSources({ release }: { release: AtlasRelease }) {
  return <div className="atlas-undated-access"><AtlasScope icon={FileClock} buttonLabel="Undated sources" label="Undated sources" title="Undated sources">
    <div className="atlas-undated-sources"><SupplementContent release={release} /></div>
  </AtlasScope></div>;
}
function SupplementContent({ release }: { release: AtlasRelease }) {
  return release.source_supplement?.path === 'source-supplement-collection.json' ? <CollectionContent release={release} /> : <SingleSupplementContent release={release} />;
}
function SingleSupplementContent({ release }: { release: AtlasRelease }) {
  const [data, setData] = useState<SourceSupplement | null>(null);
  const [error, setError] = useState<Error>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetchSourceSupplement(release, controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch(error => { if (!controller.signal.aborted) setError(error); });
    return () => controller.abort();
  }, [release, attempt]);
  if (!data) return <AtlasDetailStatus error={error} retry={() => { setError(undefined); setAttempt(value => value + 1); }} />;
  return <UndatedDocumentList documents={data.documents} renderDocument={doc => <UndatedDocumentBody doc={doc} data={data} />} />;
}
type ComponentStore = ReturnType<typeof createSupplementComponentStore>;
type ComponentLease = Awaited<ReturnType<ComponentStore['acquire']>>;
function CollectionContent({ release }: { release: AtlasRelease }) {
  const [loaded, setLoaded] = useState<{ catalogue: SupplementCatalogue; store: ComponentStore }>();
  const [error, setError] = useState<Error>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let store: ComponentStore | undefined;
    fetchSupplementCollection(release, controller.signal).then(({ collection, catalogue }) => {
      if (controller.signal.aborted) return;
      store = createSupplementComponentStore(release, collection, catalogue);
      setLoaded({ catalogue, store });
    }).catch(error => { if (!controller.signal.aborted) setError(error); });
    return () => { controller.abort(); store?.dispose(); };
  }, [release, attempt]);
  if (!loaded) return <AtlasDetailStatus error={error} retry={() => { setError(undefined); setAttempt(value => value + 1); }} />;
  return <UndatedDocumentList documents={loaded.catalogue.documents} renderDocument={doc => <CollectionDocument doc={doc} store={loaded.store} />} />;
}
function CollectionDocument({ doc, store }: { doc: SupplementCatalogue['documents'][number]; store: ComponentStore }) {
  const [data, setData] = useState<SourceSupplement>();
  const [error, setError] = useState<Error>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let lease: ComponentLease | undefined;
    store.acquire(doc.component_id, controller.signal).then(value => {
      if (controller.signal.aborted) { value.release(); return; }
      lease = value;
      setData(value.data);
    }).catch(error => { if (!controller.signal.aborted) setError(error); });
    return () => { controller.abort(); lease?.release(); };
  }, [store, doc.component_id, attempt]);
  return data ? <UndatedDocumentBody doc={doc} data={data} /> : <AtlasDetailStatus error={error} retry={() => { setError(undefined); setAttempt(value => value + 1); }} />;
}
export function UndatedDocumentList<Document extends SourceSupplement['documents'][number]>({ documents: allDocuments, renderDocument }: { documents: Document[]; renderDocument: (doc: Document) => ReactNode }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const group = useId();
  const documents = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return term ? allDocuments.filter(doc => `${doc.title} ${doc.publisher}`.toLocaleLowerCase().includes(term)) : allDocuments;
  }, [allDocuments, query]);
  const pageCount = Math.max(1, Math.ceil(documents.length / 20)), currentPage = Math.min(page, pageCount - 1);
  return <section aria-label="Undated source findings">
    <div className="atlas-undated-tools">
      <label className="atlas-undated-search"><Search size={15} aria-hidden /><input type="search" aria-label="Search undated sources" placeholder="Search titles or publishers" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <span role="status">{documents.length !== allDocuments.length ? `${documents.length} of ${allDocuments.length}` : documents.length} {allDocuments.length === 1 ? 'source' : 'sources'}</span>
    </div>
    {pageCount > 1 && <nav className="atlas-pagination atlas-undated-pages" aria-label="Undated source pages">
      <button aria-label="Previous undated source page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} aria-hidden /></button>
      <AtlasSelect label="Undated source page" value={String(currentPage)} summaryLabel={`Page ${currentPage + 1} of ${pageCount}`} items={Array.from({ length: pageCount }, (_, index) => ({ value: String(index), label: `${index + 1} / ${pageCount}` }))} onChange={value => setPage(Number(value))} />
      <button aria-label="Next undated source page" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} aria-hidden /></button>
    </nav>}
    {documents.length === 0 && <p className="atlas-empty">No sources match this search.</p>}
    {documents.slice(currentPage * 20, (currentPage + 1) * 20).map(doc => <AtlasDisclosure key={doc.id} name={group} unmountOnClose className="atlas-report atlas-undated-report" summary={<summary>
      <span className="atlas-undated-document"><FileClock size={20} aria-hidden /></span>
      <span className="atlas-report-summary"><strong>{doc.title}</strong><span>{doc.publisher}</span><span>Captured <time dateTime={doc.capture}>{formatDate(doc.capture)}</time> · Publication date not reported</span></span>
      <span className="atlas-expand" aria-hidden><ChevronDown size={17} /></span>
    </summary>}>{() => renderDocument(doc)}</AtlasDisclosure>)}
  </section>;
}
function UndatedDocumentBody({ doc, data }: { doc: SourceSupplement['documents'][number]; data: SourceSupplement }) {
  const { records, evidence, quotations } = useMemo(() => {
    const quotations = new Map<string, SourceSupplement['evidence']>();
    for (const span of data.evidence) {
      const key = JSON.stringify([span.record_id, span.claim_index]);
      if (!quotations.has(key)) quotations.set(key, []);
      quotations.get(key)!.push(span);
    }
    return { records: data.records.filter(record => record.document_id === doc.id), quotations, evidence: new Map(data.evidence.map(span => [span.id, span])) };
  }, [data, doc.id]);
  return <div className="atlas-report-body">
      <div className="atlas-item-meta atlas-report-meta"><span><CalendarDays size={14} aria-hidden />Captured <time dateTime={doc.capture}>{formatDate(doc.capture)}</time></span><a href={doc.content_url} target="_blank" rel="noopener noreferrer">Read source <ExternalLink size={14} aria-hidden /></a></div>
      <div className="atlas-undated-context"><span className="atlas-status" data-tone="warning">Source checked · Draft</span><span>Publication date not reported</span></div>
      {records.map(record => <div key={record.id}>
        {record.title !== doc.title && <h3>{record.title}</h3>}
        <div className="atlas-metrics" aria-label="Undated source figures">{record.measures.map(measure => {
          const refs = [measure.source_reference, ...(measure.context_references ?? [])];
          const quotes = [...new Set(refs.flatMap(ref => (quotations.get(JSON.stringify([ref.record_id, ref.claim_index])) ?? []).filter(span => ref.quote_indexes.includes(span.quote_index))))];
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
          <p><CountryText>{claim.text}</CountryText></p><AtlasDisclosure unmountOnClose summary={<EvidenceSummary kind="quotation" count={claim.evidence_ids.length > 1 ? claim.evidence_ids.length : undefined} />}>{() => <Quotations spans={claim.evidence_ids.map(id => evidence.get(id)!)} />}</AtlasDisclosure>
        </div>)}
        <AtlasDisclosure unmountOnClose className="atlas-measure-details" summary={<summary>Review & disclosures</summary>}>{() => <><p>{record.reviewed_by} · {formatDate(record.reviewed_at)}</p>{record.disclosures.map(text => <p key={text}>{text}</p>)}</>}</AtlasDisclosure>
      </div>)}
      <AtlasDisclosure unmountOnClose className="atlas-measure-details" summary={<summary>Source identity</summary>}>{() => <dl><div><dt>Document</dt><dd>{doc.id}</dd></div><div><dt>Raw SHA-256</dt><dd>{doc.raw_sha256}</dd></div><div><dt>Text SHA-256</dt><dd>{doc.text_sha256}</dd></div><div><dt>Source URL</dt><dd><a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.url}</a></dd></div></dl>}</AtlasDisclosure>
      <AtlasDisclosure unmountOnClose summary={<EvidenceSummary kind="scope" />}>{() => <><p>Outside the reporting window</p>{data.limitations.map(text => <p key={text}>{text}</p>)}</>}</AtlasDisclosure>
  </div>;
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
