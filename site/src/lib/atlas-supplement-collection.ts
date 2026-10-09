import { z } from 'zod';
import collectionSchema from './atlas-vendor/supplement-collection/0.1/source-supplement-collection.schema.json';
import catalogueSchema from './atlas-vendor/supplement-collection/0.1/source-supplement-catalogue.schema.json';
import { parseAtlasJson, releaseRoot, verifiedBytes, type AtlasRelease } from './atlas-release';
import { supplementSchemaHash, validateSourceSupplement, type SourceSupplement } from './atlas-supplement';

export const supplementCollectionSchemaHash = '507299f1b27126249371b2d1c5493400eb71f207b18f00ab7bd4f430739d8997';
export const supplementCatalogueSchemaHash = 'a730de9c25f22e5586fb7e4fa52330f117cd1adb9ccef0280bbafe2d7eeb1f65';
const collectionValidator = z.fromJSONSchema(collectionSchema as Parameters<typeof z.fromJSONSchema>[0]);
const catalogueValidator = z.fromJSONSchema(catalogueSchema as Parameters<typeof z.fromJSONSchema>[0]);
type Counts = { documents: number; records: number; claims: number; measures: number; evidence: number };
type File = { path: string; sha256: string; bytes: number; schema_path: string; schema_sha256: string };
export type SupplementComponent = File & { id: string; version: '0.1.0'; source_export_id: string; counts: Counts };
export type SupplementCollection = {
  collection_version: '0.1.0'; source_export_id: string; generated_at: string; selection_policy: 'outside_dated_selection';
  components: SupplementComponent[]; catalogue: File; counts: Counts;
};
export type SupplementCatalogue = {
  catalogue_version: '0.1.0'; source_export_id: string; selection_policy: 'outside_dated_selection';
  documents: (SourceSupplement['documents'][number] & { component_id: string; records: { id: string; title: string; claims: number; measures: number }[] })[];
};
function requireValid(value: unknown, message: string): asserts value { if (!value) throw new Error(`Invalid supplement collection: ${message}`); }
const hash = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), byte => byte.toString(16).padStart(2, '0')).join('');
const countKeys = ['documents', 'records', 'claims', 'measures', 'evidence'] as const;
const countsOf = (data: SourceSupplement): Counts => ({ documents: data.documents.length, records: data.records.length,
  claims: data.records.reduce((sum, row) => sum + row.claims.length, 0), measures: data.records.reduce((sum, row) => sum + row.measures.length, 0), evidence: data.evidence.length });
function unique(values: string[], label: string) { requireValid(new Set(values).size === values.length, `duplicate ${label}`); }
function sortedIds(values: string[]) {
  return values.sort((a, b) => {
    const left = [...a], right = [...b];
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      const difference = left[i].codePointAt(0)! - right[i].codePointAt(0)!;
      if (difference) return difference;
    }
    return left.length - right.length;
  });
}
function checkDocument(doc: SourceSupplement['documents'][number]) {
  z.iso.datetime({ offset: true }).parse(doc.capture);
  for (const link of [doc.url, doc.content_url]) {
    const url = new URL(link);
    requireValid(url.protocol === 'https:' && url.hostname && !url.username && !url.password, 'source URL');
  }
}
export function validateSupplementCollection(value: unknown, exportId: string): SupplementCollection {
  const data = collectionValidator.parse(value) as SupplementCollection;
  requireValid(data.source_export_id === exportId, 'export binding');
  z.iso.datetime({ offset: true }).parse(data.generated_at);
  requireValid(data.catalogue.schema_sha256 === supplementCatalogueSchemaHash, 'catalogue schema');
  unique(data.components.map(part => part.id), 'component identity');
  unique(data.components.map(part => part.sha256), 'component payload');
  requireValid(data.components.reduce((sum, part) => sum + part.bytes, 0) <= 128_000_000, 'total byte limit');
  for (const part of data.components) {
    requireValid(part.source_export_id === exportId && part.schema_sha256 === supplementSchemaHash, 'component binding or schema');
    requireValid(countKeys.every(key => Number.isSafeInteger(part.counts[key])), 'component counts');
  }
  for (const key of countKeys) requireValid(Number.isSafeInteger(data.counts[key]) && data.counts[key] === data.components.reduce((sum, part) => sum + part.counts[key], 0), 'collection counts');
  return data;
}
export async function validateSupplementCatalogue(value: unknown, collection: SupplementCollection, signal?: AbortSignal): Promise<SupplementCatalogue> {
  signal?.throwIfAborted();
  const data = catalogueValidator.parse(value) as SupplementCatalogue;
  requireValid(data.source_export_id === collection.source_export_id, 'catalogue export binding');
  unique(data.documents.map(doc => doc.id), 'document identity');
  unique(data.documents.flatMap(doc => doc.records.map(record => record.id)), 'record identity');
  const components = new Map(collection.components.map(part => [part.id, part]));
  for (const doc of data.documents) {
    requireValid(components.has(doc.component_id), 'catalogue component');
    checkDocument(doc);
    for (const row of doc.records) requireValid(Number.isSafeInteger(row.claims) && Number.isSafeInteger(row.measures), 'catalogue record counts');
  }
  for (const component of components.values()) {
    const documents = data.documents.filter(doc => doc.component_id === component.id), records = documents.flatMap(doc => doc.records);
    const id = 'supplement_' + (await hash(JSON.stringify({ documents: sortedIds(documents.map(doc => doc.id)), records: sortedIds(records.map(row => row.id)) }))).slice(0, 24);
    signal?.throwIfAborted();
    requireValid(component.id === id, 'component identity');
    requireValid(documents.length === component.counts.documents && records.length === component.counts.records &&
      records.reduce((sum, row) => sum + row.claims, 0) === component.counts.claims && records.reduce((sum, row) => sum + row.measures, 0) === component.counts.measures, 'catalogue counts');
  }
  return data;
}
export async function validateSupplementComponent(value: unknown, component: SupplementComponent, catalogue: SupplementCatalogue, signal?: AbortSignal) {
  requireValid(component.source_export_id === catalogue.source_export_id, 'component catalogue binding');
  const data = await validateSourceSupplement(value, component.source_export_id, signal);
  const counts = countsOf(data);
  requireValid(countKeys.every(key => counts[key] === component.counts[key]), 'component counts');
  const expected = new Map(catalogue.documents.filter(doc => doc.component_id === component.id).map(doc => [doc.id, doc]));
  requireValid(expected.size === data.documents.length, 'component documents');
  for (const doc of data.documents) {
    const row = expected.get(doc.id);
    requireValid(row && Object.entries(doc).every(([key, value]) => row[key as keyof typeof doc] === value), 'document projection');
    const records = data.records.filter(record => record.document_id === doc.id);
    requireValid(records.length === row.records.length && records.every((record, index) => {
      const summary = row.records[index];
      return summary.id === record.id && summary.title === record.title && summary.claims === record.claims.length && summary.measures === record.measures.length;
    }), 'record projection');
  }
  return data;
}
export function supplementCollectionRoot(release: AtlasRelease) {
  return `${releaseRoot(release)}/supplement-collections/${release.source_supplement!.sha256}`;
}
async function readFile(root: string, file: Pick<File, 'path' | 'bytes' | 'sha256'>, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const bytes = await verifiedBytes(await fetch(`${root}/${file.path}`, { signal }), file);
  return parseAtlasJson(bytes, signal);
}
export async function fetchSupplementCollection(release: AtlasRelease, signal?: AbortSignal) {
  const descriptor = release.source_supplement;
  requireValid(descriptor?.path === 'source-supplement-collection.json' && descriptor.schema_sha256 === supplementCollectionSchemaHash && descriptor.source_export_id === release.export_id && descriptor.bytes <= 2_000_000, 'descriptor');
  const root = supplementCollectionRoot(release);
  const collection = validateSupplementCollection(await readFile(root, descriptor, signal), release.export_id);
  const catalogue = await validateSupplementCatalogue(await readFile(root, collection.catalogue, signal), collection, signal);
  return { collection, catalogue };
}

export function createSupplementComponentStore(release: AtlasRelease, collection: SupplementCollection, catalogue: SupplementCatalogue) {
  requireValid(collection.source_export_id === release.export_id && catalogue.source_export_id === release.export_id, 'store export binding');
  type Entry = { controller: AbortController; promise: Promise<SourceSupplement>; users: number; bytes: number; loaded: boolean };
  const entries = new Map<string, Entry>(), components = new Map(collection.components.map(part => [part.id, part]));
  let closed = false;
  return {
    async acquire(componentId: string, signal?: AbortSignal): Promise<{ data: SourceSupplement; release(): void }> {
      signal?.throwIfAborted();
      if (closed) throw new DOMException('Supplement store is closed', 'AbortError');
      const component = components.get(componentId);
      requireValid(component, 'unknown component');
      const key = `${release.export_id}:${component.sha256}`;
      let entry = entries.get(key);
      if (!entry) {
        const controller = new AbortController();
        entry = { controller, users: 0, bytes: component.bytes, loaded: false, promise: readFile(`${releaseRoot(release)}/supplements/${component.sha256}`, component, controller.signal)
          .then(value => validateSupplementComponent(value, component, catalogue, controller.signal)) };
        entries.set(key, entry);
      }
      const held = entry;
      held.users++;
      let released = false;
      function releaseLease() {
        if (released) return;
        released = true;
        signal?.removeEventListener('abort', releaseLease);
        if (--held.users === 0) {
          held.controller.abort();
          if (entries.get(key) === held) entries.delete(key);
        }
      }
      signal?.addEventListener('abort', releaseLease, { once: true });
      const combined = signal ? AbortSignal.any([signal, held.controller.signal]) : held.controller.signal;
      try {
        const data = await new Promise<SourceSupplement>((resolve, reject) => {
          const abort = () => reject(combined.reason);
          combined.addEventListener('abort', abort, { once: true });
          held.promise.then(resolve, reject).finally(() => combined.removeEventListener('abort', abort));
          if (combined.aborted) abort();
        });
        combined.throwIfAborted();
        held.loaded = true;
        return { data, release: releaseLease };
      } catch (error) { releaseLease(); throw error; }
    },
    dispose() { closed = true; for (const entry of entries.values()) entry.controller.abort(); entries.clear(); },
    stats() { return { cachedBytes: [...entries.values()].reduce((sum, entry) => sum + (entry.loaded ? entry.bytes : 0), 0), components: entries.size }; },
  };
}
