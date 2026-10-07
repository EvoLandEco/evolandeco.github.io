import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { prepareSourceSupplement, requireCurrentSourceSupplement, verifyPublishedSourceSupplement } from '../scripts/publish-atlas-supplement';
import { stageBrowserAsset } from '../scripts/publish-atlas-browser';
import { correctionSchema } from '../scripts/sync-atlas';
import { createHash } from 'node:crypto';
import { validateSourceSupplement, fetchSourceSupplement, supplementSchemaHash, type SourceSupplement } from '../src/lib/atlas-supplement';
import { releaseSchema } from '../src/lib/atlas-release';
import fixture from './atlas-fixture.json';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const directory = process.env.ATLAS_SUPPLEMENT_FIXTURE;
test('The supplement schema matches the producer pin', async () => {
  const bytes = await readFile(new URL('../src/lib/atlas-vendor/supplement/0.1/source-supplement.schema.json', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), supplementSchemaHash);
});
test('Undated source validation preserves full evidence and rejects broken bindings', async t => {
  const body = directory ? await readFile(`${directory}/source-supplement.json`, 'utf8') : JSON.stringify(synthetic());
  const original = JSON.parse(body) as SourceSupplement;
  const descriptor = directory ? JSON.parse(await readFile(`${directory}/descriptor.json`, 'utf8')) : { version: '0.1.0', source_export_id: original.source_export_id, path: 'source-supplement.json', schema_path: 'source-supplement.schema.json', schema_sha256: supplementSchemaHash, sha256: hash(body), bytes: Buffer.byteLength(body) };
  const base = { ...fixture.release, export_id: original.source_export_id };
  const release = releaseSchema.parse({ ...base, source_supplement: descriptor });
  const validated = await validateSourceSupplement(original, original.source_export_id);
  assert.deepEqual(validated.evidence, original.evidence);
  assert.deepEqual(validated.documents, original.documents);
  assert.equal(original.documents[0].publication, null);
  const dated = structuredClone(base);
  let requested = '';
  t.mock.method(globalThis, 'fetch', async (url: string) => { requested = url; return new Response(body); });
  assert.deepEqual(await fetchSourceSupplement(release), validated);
  assert(requested.endsWith(`/supplements/${descriptor.sha256}/source-supplement.json`));
  assert.deepEqual(base, dated);
  await assert.rejects(fetchSourceSupplement({ ...release, source_supplement: { ...descriptor, sha256: 'f'.repeat(64) } }), /checksum/);
  await assert.rejects(fetchSourceSupplement({ ...release, source_supplement: { ...descriptor, source_export_id: 'f'.repeat(64) } }), /descriptor/);
  for (const mutate of [
    (v: SourceSupplement) => { v.source_export_id = 'f'.repeat(64); },
    (v: SourceSupplement) => { v.documents.push(v.documents[0]); },
    (v: SourceSupplement) => { v.records[0].document_id = 'missing'; },
    (v: SourceSupplement) => { v.records[0].claims[0].evidence_ids = ['missing']; },
    (v: SourceSupplement) => { v.evidence[0].quote += 'tampered'; },
    (v: SourceSupplement) => { v.evidence[0].start++; },
    (v: SourceSupplement) => { v.evidence[0].source_text_sha256 = 'f'.repeat(64); },
    (v: SourceSupplement) => { v.evidence[0].quote_index = -1; },
    (v: SourceSupplement) => { v.documents[0].url = 'javascript:alert(1)'; },
    (v: SourceSupplement) => { v.documents[0].capture = '2026-10'; },
    (v: SourceSupplement) => { v.records[0].measures[0].source_reference.quote_indexes = [999]; },
    (v: SourceSupplement) => { v.records[0].measures[0].supersedes = [v.records[0].measures[0].annotation_key]; },
  ]) {
    const value = structuredClone(original); mutate(value);
    await assert.rejects(validateSourceSupplement(value, original.source_export_id));
  }
  const unicode = structuredClone(original);
  unicode.evidence[0].quote = 'An exact quotation 🦉';
  unicode.evidence[0].end = unicode.evidence[0].start + [...unicode.evidence[0].quote].length;
  unicode.evidence[0].quote_sha256 = hash(unicode.evidence[0].quote);
  await validateSourceSupplement(unicode, unicode.source_export_id);
  await assert.rejects(validateSourceSupplement({ ...original, documents: [{ ...original.documents[0], publication: '2026-10-07' }] }, original.source_export_id));
  assert.throws(() => releaseSchema.parse({ ...release, source_supplement: { ...descriptor, path: '../private.json' } }));
  assert.throws(() => releaseSchema.parse({ ...release, source_supplement: { ...descriptor, schema_sha256: 'f'.repeat(64) } }));
});

function synthetic() {
  const document = 'doc_' + 'a'.repeat(24), record = document + ':0', quote = 'Synthetic observation quotation 🦉';
  const missing = { value: null, status: 'not_reported' };
  return {
    supplement_version: '0.1.0', source_export_id: 'a'.repeat(64), generated_at: '2026-10-07T08:00:00Z', review_status: 'source_checked_draft', selection_policy: 'outside_dated_selection', limitations: ['Synthetic test content'],
    documents: [{ id: document, publisher: 'Test publisher', title: 'Test source', url: 'https://example.org/source', content_url: 'https://example.org/source', publication: null, publication_status: 'not_reported', capture: '2026-10-07T08:00:00Z', raw_sha256: 'b'.repeat(64), text_sha256: 'c'.repeat(64) }],
    evidence: [{ id: 'e1', document_id: document, record_id: record, claim_index: 0, quote_index: 0, section: 'Test', page: null, quote, quote_sha256: hash(quote), source_text_sha256: 'c'.repeat(64), start: 0, end: [...quote].length, offset_basis: 'unicode_code_points_half_open' }],
    records: [{ id: record, document_id: document, title: 'Test record', reviewed_at: '2026-10-07T08:00:00Z', reviewed_by: 'Test reviewer', disclosures: [], claims: [{ claim_index: 0, text: quote, evidence_ids: ['e1'] }], measures: [{ annotation_key: 'm1', label: 'Test measure', value: null, value_status: 'not_reported', metric: 'other', unit: 'other', count_kind: 'unknown', case_class: 'unknown', date_basis: 'unknown', evidence: { field: 'Test', quote }, disease: missing, pathogen: missing, host: missing, geography: missing, period_label: 'Unknown', source_reference: { record_id: record, document_id: document, claim_index: 0, quote_indexes: [0] }, semantic_note: 'Synthetic scope for validation checks.' }] }],
  };
}


test('Supplement publication binds authorization, preserves attachments and verifies immutable public files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'atlas-supplement-publication-'));
  try {
    const body = Buffer.from(JSON.stringify(synthetic()));
    const schema = await readFile(new URL('../src/lib/atlas-vendor/supplement/0.1/source-supplement.schema.json', import.meta.url));
    const files: Record<string, { path: string; bytes: number; sha256: string }> = {};
    for (const [name, bytes] of [['source-supplement.json', body], ['source-supplement.schema.json', schema]] as const) {
      const path = join(dir, name);
      await writeFile(path, bytes);
      files[name] = { path, bytes: bytes.length, sha256: hash(bytes.toString()) };
    }
    const base = releaseSchema.parse({ ...fixture.release, export_id: synthetic().source_export_id });
    const descriptor = { version: '0.1.0', source_export_id: base.export_id, path: 'source-supplement.json', schema_path: 'source-supplement.schema.json', schema_sha256: supplementSchemaHash, sha256: hash(body.toString()), bytes: body.length };
    const authorization = { pointer_descriptor: descriptor, files };
    const correction = correctionSchema.parse({ correction_version: '1.0.0', replaces_export_id: fixture.release.export_id,
      reason: 'Synthetic publication check', authorization: { thread_id: 'test', instruction: 'Publish these exact synthetic files' },
      export: { bundle_path: '/synthetic/bundle', map_snapshot_path: '/synthetic/map' }, source_supplement: authorization });
    const plan = await prepareSourceSupplement(correction.source_supplement, base);
    const release = releaseSchema.parse({ ...base, source_supplement: plan.descriptor });
    assert.equal(plan.counts.quotations, 1);
    assert.deepEqual(release.assets, base.assets);
    requireCurrentSourceSupplement(release, structuredClone(release));
    assert.throws(() => requireCurrentSourceSupplement(release, base), /must include/);
    assert.throws(() => requireCurrentSourceSupplement(release, { ...release, source_supplement: { ...release.source_supplement!, sha256: 'f'.repeat(64) } }), /must preserve/);
    await assert.rejects(prepareSourceSupplement(authorization, { ...base, export_id: 'f'.repeat(64) }), /bind/);
    await assert.rejects(prepareSourceSupplement({ ...authorization, pointer_descriptor: { ...descriptor, bytes: body.length + 1 } }, base), /descriptor mismatch/);
    await assert.rejects(prepareSourceSupplement({ ...authorization, files: { ...files, 'source-supplement.schema.json': files['source-supplement.json'] } }, base), /schema mismatch/);
    const objects = new Map<string, string>();
    let writes = 0;
    const read = async (key: string) => objects.has(key)
      ? new Response(new Uint8Array(gunzipSync(await readFile(objects.get(key)!))), { headers: { 'Content-Encoding': 'gzip' } })
      : new Response(null, { status: 404 });
    const put = (key: string, path: string) => { assert(key.endsWith('.gz')); objects.set(key.slice(0, -3), path); writes++; };
    for (const ref of plan.files) await stageBrowserAsset(ref.key, ref.content, dir, read, put);
    await verifyPublishedSourceSupplement(release, read);
    for (const ref of plan.files) await stageBrowserAsset(ref.key, ref.content, dir, read, put);
    assert.equal(writes, 2);
    await assert.rejects(verifyPublishedSourceSupplement(release, async () => new Response('{}')), /checksum/);
    await assert.rejects(verifyPublishedSourceSupplement(release, async () => new Response(null, { status: 404 })), /404/);
    await assert.rejects(stageBrowserAsset(plan.files[0].key, Buffer.from('{}'), dir, read, put), /checksum/);
    assert.equal(writes, 2);
    await writeFile(files['source-supplement.json'].path, '{}');
    await assert.rejects(prepareSourceSupplement(authorization, release), /file changed/);
  } finally { await rm(dir, { recursive: true }); }
});
