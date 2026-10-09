import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { supplementSchemaHash, type SourceSupplement } from '../src/lib/atlas-supplement';
import { supplementCatalogueSchemaHash, supplementCollectionSchemaHash, type SupplementCatalogue, type SupplementCollection } from '../src/lib/atlas-supplement-collection';

export async function collectionFixture(exportId = 'a'.repeat(64)) {
  const hash = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex');
  const files: Record<string, Buffer> = {};
  const parts: SourceSupplement[] = [];
  const catalogue: SupplementCatalogue = { catalogue_version: '0.1.0', source_export_id: exportId, selection_policy: 'outside_dated_selection', documents: [] };
  const components: SupplementCollection['components'] = [];
  const generatedAt = '2026-10-08T08:00:00Z';
  for (let i = 0; i < 2; i++) {
    const id = `doc_${i.toString(16).padStart(24, '0')}`, recordId = `${id}:0`, quote = `Synthetic source ${i + 1} reports an observation.`;
    const doc = { id, title: `Synthetic source ${i + 1}`, publisher: 'Test publisher', url: `https://example.org/${i}`, content_url: `https://example.org/${i}`, publication: null, publication_status: 'not_reported' as const, capture: generatedAt, raw_sha256: hash(quote), text_sha256: hash(quote) };
    const data: SourceSupplement = { supplement_version: '0.1.0', source_export_id: exportId, generated_at: generatedAt, selection_policy: 'outside_dated_selection', review_status: 'source_checked_draft', limitations: ['Synthetic test source.'], documents: [doc],
      records: [{ id: recordId, document_id: id, title: doc.title, reviewed_at: generatedAt, reviewed_by: 'Test reviewer', disclosures: [], claims: [{ claim_index: 0, text: quote, evidence_ids: [`e${i}`] }], measures: [] }],
      evidence: [{ id: `e${i}`, document_id: id, record_id: recordId, claim_index: 0, quote_index: 0, quote, quote_sha256: hash(quote), source_text_sha256: hash(quote), start: 0, end: quote.length, offset_basis: 'unicode_code_points_half_open', page: null, section: 'Findings' }] };
    parts.push(data);
    const body = Buffer.from(JSON.stringify(data));
    const component = { id: `supplement_${hash(JSON.stringify({ documents: [id], records: [recordId] })).slice(0, 24)}`, version: '0.1.0' as const, source_export_id: exportId, path: 'source-supplement.json', schema_path: 'source-supplement.schema.json', schema_sha256: supplementSchemaHash, sha256: hash(body), bytes: body.length, counts: { documents: 1, records: 1, claims: 1, measures: 0, evidence: 1 } };
    components.push(component);
    catalogue.documents.push({ ...doc, component_id: component.id, records: [{ id: recordId, title: doc.title, claims: 1, measures: 0 }] });
    files[`supplements/${component.sha256}/source-supplement.json`] = body;
    files[`supplements/${component.sha256}/source-supplement.schema.json`] = readFileSync(new URL('../src/lib/atlas-vendor/supplement/0.1/source-supplement.schema.json', import.meta.url));
  }
  files['source-supplement-catalogue.json'] = Buffer.from(JSON.stringify(catalogue));
  for (const name of ['source-supplement-catalogue.schema.json', 'source-supplement-collection.schema.json']) files[name] = readFileSync(new URL(`../src/lib/atlas-vendor/supplement-collection/0.1/${name}`, import.meta.url));
  const catalogueBytes = files['source-supplement-catalogue.json'];
  const collection: SupplementCollection = { collection_version: '0.1.0', source_export_id: exportId, generated_at: generatedAt, selection_policy: 'outside_dated_selection', components, counts: { documents: 2, records: 2, claims: 2, measures: 0, evidence: 2 }, catalogue: { path: 'source-supplement-catalogue.json', sha256: hash(catalogueBytes), bytes: catalogueBytes.length, schema_path: 'source-supplement-catalogue.schema.json', schema_sha256: supplementCatalogueSchemaHash } };
  const body = files['source-supplement-collection.json'] = Buffer.from(JSON.stringify(collection));
  const descriptor = { version: '0.1.0' as const, source_export_id: exportId, path: 'source-supplement-collection.json' as const, schema_path: 'source-supplement-collection.schema.json' as const, schema_sha256: supplementCollectionSchemaHash, sha256: hash(body), bytes: body.length };
  return { descriptor, collection, catalogue, files, parts };
}
