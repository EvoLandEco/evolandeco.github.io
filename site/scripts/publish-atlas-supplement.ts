import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { createAtlasPublicReader } from './atlas-public-reader';
import { releaseSchema, verifiedBytes, type AtlasRelease } from '../src/lib/atlas-release';
import { validateSourceSupplement, supplementSchemaHash, type SourceSupplement } from '../src/lib/atlas-supplement';
import { validateSupplementCollection, validateSupplementCatalogue, validateSupplementComponent,
  supplementCollectionSchemaHash, supplementCatalogueSchemaHash } from '../src/lib/atlas-supplement-collection';

const fingerprint = (bytes: Uint8Array) => ({ bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
const file = z.strictObject({ path: z.string().refine(isAbsolute), bytes: z.number().int().positive().safe(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const packagePath = z.string().regex(/^(?:source-supplement(?:-(?:collection|catalogue))?(?:\.schema)?\.json|supplements\/[a-f0-9]{64}\/source-supplement(?:\.schema)?\.json)$/);
export const supplementPublicationSchema = z.strictObject({
  pointer_descriptor: releaseSchema.shape.source_supplement.unwrap(),
  files: z.record(packagePath, file),
});
type Descriptor = NonNullable<AtlasRelease['source_supplement']>;
type Asset = { bytes: number; sha256: string };
type PublishedFile = z.infer<typeof file> & { key: string; content: Buffer };
const parse = (bytes: Uint8Array): unknown => JSON.parse(Buffer.from(bytes).toString());
function exactFiles(files: Record<string, unknown>, expected: string[]) {
  assert.deepEqual(Object.keys(files).sort(), [...expected].sort(), 'Supplement authorization file set mismatch');
}
async function bundledSchema(name: string, collection = false) {
  return fingerprint(await readFile(new URL(`../src/lib/atlas-vendor/${collection ? 'supplement-collection' : 'supplement'}/0.1/${name}`, import.meta.url)));
}
function uniqueCollectionIdentities() {
  const seen = { documents: new Set<string>(), records: new Set<string>(), evidence: new Set<string>(), measures: new Set<string>() };
  return (data: SourceSupplement) => {
    const identities = { documents: data.documents.map(row => row.id), records: data.records.map(row => row.id),
      evidence: data.evidence.map(row => row.id), measures: data.records.flatMap(row => row.measures.map(measure => measure.annotation_key)) };
    for (const key of ['documents', 'records', 'evidence', 'measures'] as const) for (const id of identities[key]) {
      assert(!seen[key].has(id), `Duplicate collection ${key} identity: ${id}`);
      seen[key].add(id);
    }
  };
}
async function checkCollection(descriptor: Extract<Descriptor, { path: 'source-supplement-collection.json' }>,
  read: (name: string, expected: Asset) => Promise<Uint8Array>, checkFiles?: (names: string[]) => void) {
  const collection = await validateSupplementCollection(parse(await read(descriptor.path, descriptor)), descriptor.source_export_id);
  const names = [descriptor.path, descriptor.schema_path, collection.catalogue.path, collection.catalogue.schema_path,
    ...collection.components.flatMap(part => [`supplements/${part.sha256}/${part.path}`, `supplements/${part.sha256}/${part.schema_path}`])];
  assert.equal(new Set(names).size, names.length, 'Duplicate collection file path');
  checkFiles?.(names);
  const schema = await bundledSchema(descriptor.schema_path, true);
  assert.equal(schema.sha256, supplementCollectionSchemaHash, 'Bundled collection schema mismatch');
  assert.equal(descriptor.schema_sha256, schema.sha256, 'Collection schema mismatch');
  await read(descriptor.schema_path, schema);
  const catalogueSchema = await bundledSchema(collection.catalogue.schema_path, true);
  assert.equal(catalogueSchema.sha256, supplementCatalogueSchemaHash, 'Bundled catalogue schema mismatch');
  assert.equal(collection.catalogue.schema_sha256, catalogueSchema.sha256, 'Catalogue schema mismatch');
  await read(collection.catalogue.schema_path, catalogueSchema);
  const catalogue = await validateSupplementCatalogue(parse(await read(collection.catalogue.path, collection.catalogue)), collection);
  const componentSchema = await bundledSchema('source-supplement.schema.json');
  assert.equal(componentSchema.sha256, supplementSchemaHash, 'Bundled supplement schema mismatch');
  const checkIdentities = uniqueCollectionIdentities();
  for (const part of collection.components) {
    assert.equal(part.schema_sha256, componentSchema.sha256, 'Component schema mismatch');
    await read(`supplements/${part.sha256}/${part.schema_path}`, componentSchema);
    const data = await validateSupplementComponent(parse(await read(`supplements/${part.sha256}/${part.path}`, part)), part, catalogue);
    checkIdentities(data);
  }
  return { documents: collection.counts.documents, records: collection.counts.records, measures: collection.counts.measures, quotations: collection.counts.evidence };
}
function storageKey(descriptor: Descriptor, name: string) {
  const root = `releases/${descriptor.source_export_id}`;
  if (descriptor.path === 'source-supplement.json') return `${root}/supplements/${descriptor.sha256}/${name}`;
  return name.startsWith('supplements/') ? `${root}/${name}` : `${root}/supplement-collections/${descriptor.sha256}/${name}`;
}
export async function prepareSourceSupplement(input: unknown, release: AtlasRelease) {
  const publication = supplementPublicationSchema.parse(input);
  const descriptor = publication.pointer_descriptor;
  assert.equal(descriptor.source_export_id, release.export_id, 'Supplement authorization must bind the scientific export');
  if (release.source_supplement) assert.deepEqual(release.source_supplement, descriptor, 'Supplement descriptor differs from authorization');
  const files: PublishedFile[] = [];
  const read = async (name: string, expected?: Asset) => {
    const ref = publication.files[name];
    assert(ref, `Missing supplement authorization file: ${name}`);
    if (expected) assert.deepEqual({ bytes: ref.bytes, sha256: ref.sha256 }, { bytes: expected.bytes, sha256: expected.sha256 }, `Supplement asset descriptor mismatch: ${name}`);
    const bytes = await readFile(ref.path);
    assert.deepEqual(fingerprint(bytes), { bytes: ref.bytes, sha256: ref.sha256 }, `Supplement file changed: ${name}`);
    files.push({ ...ref, key: storageKey(descriptor, name), content: bytes });
    return bytes;
  };
  if (descriptor.path === 'source-supplement-collection.json') {
    const counts = await checkCollection(descriptor, read, names => exactFiles(publication.files, names));
    return { descriptor, files, counts };
  }
  exactFiles(publication.files, [descriptor.path, descriptor.schema_path]);
  const bytes = await read(descriptor.path, descriptor);
  await read(descriptor.schema_path);
  assert.equal(publication.files[descriptor.schema_path].sha256, supplementSchemaHash, 'Supplement schema mismatch');
  const data = await validateSourceSupplement(parse(bytes), release.export_id);
  return { descriptor, files, counts: { documents: data.documents.length, records: data.records.length, measures: data.records.reduce((sum, row) => sum + row.measures.length, 0), quotations: data.evidence.length } };
}
export function requireDatedReportRelease(candidate: AtlasRelease) {
  assert(!candidate.source_supplement, 'Public releases exclude undated source supplements and collections');
}
export function requireCurrentSourceSupplement(current: AtlasRelease, candidate: AtlasRelease) {
  if (candidate.source_supplement) assert.equal(candidate.source_supplement.source_export_id, candidate.export_id, 'Supplement release binding mismatch');
  if (!current.source_supplement) return;
  assert(candidate.source_supplement, 'Publication must include a supplement bound to the candidate export');
  if (current.export_id === candidate.export_id) assert.deepEqual(candidate.source_supplement, current.source_supplement, 'A same-export publication must preserve the current supplement');
}
export async function verifyPublishedSourceSupplement(release: AtlasRelease, read = createAtlasPublicReader()) {
  if (!release.source_supplement) return;
  const descriptor = releaseSchema.shape.source_supplement.unwrap().parse(release.source_supplement);
  assert.equal(descriptor.source_export_id, release.export_id, 'Supplement release binding mismatch');
  const readAsset = async (name: string, expected: Asset) => new Uint8Array(await verifiedBytes(await read(storageKey(descriptor, name)), expected));
  if (descriptor.path === 'source-supplement-collection.json') {
    await checkCollection(descriptor, readAsset);
    return;
  }
  const schema = await bundledSchema(descriptor.schema_path);
  assert.equal(schema.sha256, descriptor.schema_sha256, 'Bundled supplement schema mismatch');
  await readAsset(descriptor.schema_path, schema);
  await validateSourceSupplement(parse(await readAsset(descriptor.path, descriptor)), release.export_id);
}
