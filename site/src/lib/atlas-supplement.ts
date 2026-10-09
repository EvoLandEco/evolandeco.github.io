import { z } from 'zod';
import schema from './atlas-vendor/supplement/0.1/source-supplement.schema.json';
import { atlasOrigin, parseAtlasJson, verifiedBytes, type AtlasRelease } from './atlas-release';
import type { Measure } from './atlas-metrics';

export const supplementSchemaHash = '2314d67db4e9cf1c7c0abab880e5644c21320f2a03fa43bd01a41e6c3015ac01';
const supplementSchema = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]);
type ClaimRef = { record_id: string; document_id: string; claim_index: number; quote_indexes: number[] };
type SupplementMeasure = Pick<Measure, 'value' | 'value_status' | 'unit' | 'label' | 'period_label'> & {
  annotation_key: string; semantic_note: string; qualifier?: string; evidence: { quote: string }; source_reference: ClaimRef;
  context_references?: ClaimRef[]; supersedes?: string[]; [field: string]: unknown;
};
export type SourceSupplement = {
  supplement_version: '0.1.0'; source_export_id: string; generated_at: string;
  review_status: 'source_checked_draft'; selection_policy: 'outside_dated_selection'; limitations: string[];
  documents: { id: string; title: string; publisher: string; url: string; content_url: string; publication: null; publication_status: 'not_reported'; capture: string; raw_sha256: string; text_sha256: string }[];
  records: { id: string; document_id: string; title: string; reviewed_at: string; reviewed_by: string; disclosures: string[];
    claims: { claim_index: number; text: string; evidence_ids: string[] }[]; measures: SupplementMeasure[] }[];
  evidence: { id: string; document_id: string; record_id: string; claim_index: number; quote_index: number; quote: string; quote_sha256: string; source_text_sha256: string; start: number; end: number; offset_basis: 'unicode_code_points_half_open'; page: number | null; section: string }[];
};
const hash = async (text: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const slot = (record: string, claim: number, quote?: number) => JSON.stringify([record, claim, quote]);
function requireValid(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Invalid source supplement: ${message}`); }
function index<T extends { id: string }>(rows: T[]) {
  const result = new Map(rows.map(row => [row.id, row]));
  requireValid(result.size === rows.length, 'duplicate identity');
  return result;
}
export async function validateSourceSupplement(value: unknown, exportId: string, signal?: AbortSignal): Promise<SourceSupplement> {
  signal?.throwIfAborted();
  const data = supplementSchema.parse(value) as SourceSupplement;
  signal?.throwIfAborted();
  requireValid(data.source_export_id === exportId, 'release binding');
  z.iso.datetime({ offset: true }).parse(data.generated_at);
  const documents = index(data.documents), records = index(data.records), evidence = index(data.evidence);
  const claims = new Map<string, SourceSupplement['records'][number]['claims'][number]>();
  const quotes = new Map<string, SourceSupplement['evidence'][number]>();
  for (const doc of documents.values()) {
    z.iso.datetime({ offset: true }).parse(doc.capture);
    for (const link of [doc.url, doc.content_url]) {
      const url = new URL(link);
      requireValid(url.protocol === 'https:' && url.hostname && !url.username && !url.password, 'source URL');
    }
  }
  for (const record of records.values()) {
    requireValid(documents.has(record.document_id), 'record document');
    z.iso.datetime({ offset: true }).parse(record.reviewed_at);
    for (const claim of record.claims) {
      const key = slot(record.id, claim.claim_index);
      requireValid(!claims.has(key) && new Set(claim.evidence_ids).size === claim.evidence_ids.length, 'duplicate claim or evidence reference');
      claims.set(key, claim);
    }
  }
  for (const span of evidence.values()) {
    signal?.throwIfAborted();
    const record = records.get(span.record_id), claim = claims.get(slot(span.record_id, span.claim_index));
    requireValid(record?.document_id === span.document_id && claim?.evidence_ids.includes(span.id), 'evidence document or claim');
    const key = slot(span.record_id, span.claim_index, span.quote_index);
    requireValid(Number.isInteger(span.quote_index) && span.quote_index >= 0 && !quotes.has(key), 'quotation index');
    requireValid(span.quote.trim() && span.end - span.start === [...span.quote].length && await hash(span.quote) === span.quote_sha256 && span.source_text_sha256 === documents.get(span.document_id)!.text_sha256, 'quotation hash or offsets');
    signal?.throwIfAborted();
    quotes.set(key, span);
  }
  for (const record of records.values()) for (const claim of record.claims) for (const id of claim.evidence_ids) {
    const span = evidence.get(id);
    requireValid(span?.record_id === record.id && span.claim_index === claim.claim_index, 'missing claim evidence');
  }
  const measures = new Map<string, SupplementMeasure>();
  for (const record of records.values()) for (const measure of record.measures) {
    requireValid(!measures.has(measure.annotation_key) && measure.source_reference.record_id === record.id, 'measurement identity');
    measures.set(measure.annotation_key, measure);
    for (const ref of [measure.source_reference, ...(measure.context_references ?? [])]) {
      requireValid(records.get(ref.record_id)?.document_id === ref.document_id, 'measurement document');
      for (const qi of ref.quote_indexes) requireValid(quotes.has(slot(ref.record_id, ref.claim_index, qi)), 'measurement quotation');
    }
  }
  const visited = new Set<string>(), active = new Set<string>();
  function visit(key: string) {
    requireValid(measures.has(key) && !active.has(key), 'measurement revision');
    if (visited.has(key)) return;
    active.add(key);
    for (const previous of measures.get(key)!.supersedes ?? []) visit(previous);
    active.delete(key); visited.add(key);
  }
  for (const key of measures.keys()) visit(key);
  return data;
}
export function supplementRoot(release: AtlasRelease) {
  return `${atlasOrigin}/releases/${release.export_id}/supplements/${release.source_supplement!.sha256}`;
}
export async function fetchSourceSupplement(release: AtlasRelease, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const descriptor = release.source_supplement;
  requireValid(descriptor?.path === 'source-supplement.json' && descriptor.source_export_id === release.export_id && descriptor.schema_sha256 === supplementSchemaHash, 'descriptor');
  const bytes = await verifiedBytes(await fetch(`${supplementRoot(release)}/${descriptor.path}`, { signal }), descriptor);
  signal?.throwIfAborted();
  return validateSourceSupplement(await parseAtlasJson(bytes, signal), release.export_id, signal);
}
