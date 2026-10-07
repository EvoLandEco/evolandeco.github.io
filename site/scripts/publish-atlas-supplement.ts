import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import hosting from '../src/content-data/atlas-hosting.json';
import { releaseSchema, verifiedBytes, type AtlasRelease } from '../src/lib/atlas-release';
import { validateSourceSupplement, supplementSchemaHash } from '../src/lib/atlas-supplement';

const fingerprint = (bytes: Uint8Array) => ({ bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
const file = z.strictObject({ path: z.string().refine(isAbsolute), bytes: z.number().int().positive().safe(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export const supplementPublicationSchema = z.strictObject({
  pointer_descriptor: releaseSchema.shape.source_supplement.unwrap(),
  files: z.strictObject({ 'source-supplement.json': file, 'source-supplement.schema.json': file }),
});
export async function prepareSourceSupplement(input: unknown, release: AtlasRelease) {
  const publication = supplementPublicationSchema.parse(input);
  const descriptor = publication.pointer_descriptor;
  assert.equal(descriptor.source_export_id, release.export_id, 'Supplement authorization must bind the scientific export');
  if (release.source_supplement) assert.deepEqual(release.source_supplement, descriptor, 'Supplement descriptor differs from authorization');
  const prefix = `releases/${release.export_id}/supplements/${descriptor.sha256}`;
  const files = [];
  for (const [name, ref] of Object.entries(publication.files)) {
    const bytes = await readFile(ref.path);
    assert.deepEqual(fingerprint(bytes), { bytes: ref.bytes, sha256: ref.sha256 }, `Supplement file changed: ${name}`);
    files.push({ ...ref, key: `${prefix}/${name}`, content: bytes });
  }
  const payload = publication.files['source-supplement.json'];
  assert.deepEqual({ bytes: payload.bytes, sha256: payload.sha256 }, { bytes: descriptor.bytes, sha256: descriptor.sha256 }, 'Supplement payload descriptor mismatch');
  assert.equal(publication.files['source-supplement.schema.json'].sha256, supplementSchemaHash, 'Supplement schema mismatch');
  const data = await validateSourceSupplement(JSON.parse(files.find(ref => ref.key.endsWith('/source-supplement.json'))!.content.toString()), release.export_id);
  return { descriptor, files, counts: { documents: data.documents.length, records: data.records.length, measures: data.records.reduce((sum, row) => sum + row.measures.length, 0), quotations: data.evidence.length } };
}
export function requireCurrentSourceSupplement(current: AtlasRelease, candidate: AtlasRelease) {
  if (!current.source_supplement) return;
  assert(candidate.source_supplement, 'Publication must include a supplement bound to the candidate export');
  if (current.export_id === candidate.export_id) assert.deepEqual(candidate.source_supplement, current.source_supplement, 'A same-export publication must preserve the current supplement');
}
export async function verifyPublishedSourceSupplement(release: AtlasRelease, read = (key: string) => fetch(`${hosting.origin}/${key}`, { cache: 'no-cache' })) {
  const descriptor = release.source_supplement;
  if (!descriptor) return;
  assert.equal(descriptor.source_export_id, release.export_id, 'Supplement release binding mismatch');
  const prefix = `releases/${release.export_id}/supplements/${descriptor.sha256}`;
  const schema = await readFile(new URL('../src/lib/atlas-vendor/supplement/0.1/source-supplement.schema.json', import.meta.url));
  assert.equal(fingerprint(schema).sha256, descriptor.schema_sha256, 'Bundled supplement schema mismatch');
  await verifiedBytes(await read(`${prefix}/${descriptor.schema_path}`), fingerprint(schema));
  const bytes = await verifiedBytes(await read(`${prefix}/${descriptor.path}`), descriptor);
  await validateSourceSupplement(JSON.parse(Buffer.from(bytes).toString()), release.export_id);
}
