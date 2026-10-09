import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { prepareSourceSupplement, requireCurrentSourceSupplement, verifyPublishedSourceSupplement } from '../scripts/publish-atlas-supplement';
import { attachBrowserDescriptor, stageBrowserAsset } from '../scripts/publish-atlas-browser';
import { correctionSchema, requireSyncAttachments } from '../scripts/sync-atlas';
import { releaseSchema } from '../src/lib/atlas-release';
import { supplementSchemaHash } from '../src/lib/atlas-supplement';
import { collectionFixture } from './atlas-supplement-collection-fixture';
import fixture from './atlas-fixture.json';

type CollectionFixture = Awaited<ReturnType<typeof collectionFixture>>;
const fingerprint = (bytes: Uint8Array) => ({ bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') });
const releaseFor = (data: CollectionFixture) => releaseSchema.parse({ ...fixture.release, export_id: data.descriptor.source_export_id, source_supplement: data.descriptor });
async function localAuthorization(t: TestContext, data: CollectionFixture) {
  const directory = await mkdtemp(join(tmpdir(), 'atlas-collection-publication-'));
  t.after(() => rm(directory, { recursive: true }));
  const files: Record<string, { path: string; bytes: number; sha256: string }> = {};
  for (const [name, bytes] of Object.entries(data.files)) {
    const path = join(directory, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    files[name] = { path, ...fingerprint(bytes) };
  }
  return { directory, authorization: { pointer_descriptor: data.descriptor, files } };
}
function publicReader(data: CollectionFixture) {
  const root = `releases/${data.descriptor.source_export_id}`;
  const assets = new Map(Object.entries(data.files).map(([name, bytes]) => [name.startsWith('supplements/') ? `${root}/${name}` : `${root}/supplement-collections/${data.descriptor.sha256}/${name}`, bytes]));
  return async (key: string) => assets.has(key) ? new Response(new Uint8Array(assets.get(key)!)) : new Response(null, { status: 404 });
}
function seal(data: CollectionFixture) {
  const catalogue = data.files[data.collection.catalogue.path] = Buffer.from(JSON.stringify(data.catalogue));
  Object.assign(data.collection.catalogue, fingerprint(catalogue));
  const body = data.files[data.descriptor.path] = Buffer.from(JSON.stringify(data.collection));
  Object.assign(data.descriptor, fingerprint(body));
}
function replacePart(data: CollectionFixture, index: number) {
  const payload = data.parts[index];
  const id = data.catalogue.documents.find(doc => doc.id === payload.documents[0].id)!.component_id;
  const part = data.collection.components.find(part => part.id === id)!;
  const oldRoot = `supplements/${part.sha256}`;
  const schema = data.files[`${oldRoot}/${part.schema_path}`];
  delete data.files[`${oldRoot}/${part.path}`];
  delete data.files[`${oldRoot}/${part.schema_path}`];
  const body = Buffer.from(JSON.stringify(payload));
  Object.assign(part, fingerprint(body));
  data.files[`supplements/${part.sha256}/${part.path}`] = body;
  data.files[`supplements/${part.sha256}/${part.schema_path}`] = schema;
}

test('Collection publication verifies every authorized immutable file and keeps scientific assets intact', async t => {
  const data = await collectionFixture();
  const release = releaseFor(data), base = releaseSchema.parse({ ...release, source_supplement: undefined });
  const { directory, authorization } = await localAuthorization(t, data);
  const correction = correctionSchema.parse({ correction_version: '1.0.0', replaces_export_id: fixture.release.export_id,
    reason: 'Synthetic collection publication check', authorization: { thread_id: 'test', instruction: 'Publish these exact synthetic files' },
    export: { bundle_path: '/synthetic/bundle', map_snapshot_path: '/synthetic/map' }, source_supplement: authorization });
  const plan = await prepareSourceSupplement(correction.source_supplement, base);
  assert.deepEqual(plan.descriptor, data.descriptor);
  assert.deepEqual(plan.counts, { documents: 2, records: 2, measures: 0, quotations: 2 });
  assert.deepEqual(release.assets, base.assets);
  const { browser: _browser, ...withoutBrowser } = release;
  const browserRelease = attachBrowserDescriptor(withoutBrowser, { sha256: 'f'.repeat(64), bytes: 100 });
  assert.deepEqual(releaseSchema.parse(browserRelease).source_supplement, data.descriptor);
  assert.equal(plan.files.length, 8);
  assert.equal(new Set(plan.files.map(file => file.key)).size, 8);
  assert.equal(plan.files.filter(file => file.key.includes('/supplement-collections/')).length, 4);
  assert.equal(plan.files.filter(file => file.key.includes('/supplements/')).length, 4);
  const objects = new Map<string, string>();
  let writes = 0;
  const read = async (key: string) => objects.has(key)
    ? new Response(new Uint8Array(gunzipSync(await readFile(objects.get(key)!))), { headers: { 'Content-Encoding': 'gzip' } }) : new Response(null, { status: 404 });
  const put = (key: string, path: string) => { assert(key.endsWith('.gz')); objects.set(key.slice(0, -3), path); writes++; };
  for (const file of plan.files) await stageBrowserAsset(file.key, file.content, directory, read, put);
  await verifyPublishedSourceSupplement(release, read);
  for (const file of plan.files) await stageBrowserAsset(file.key, file.content, directory, read, put);
  assert.equal(writes, 8);
  const componentKey = plan.files.find(file => file.key.endsWith('/source-supplement.json'))!.key;
  for (const response of [() => new Response('{}'), () => new Response(null, { status: 404 })])
    await assert.rejects(verifyPublishedSourceSupplement(release, key => key === componentKey ? Promise.resolve(response()) : read(key)));
  await assert.rejects(stageBrowserAsset(componentKey, Buffer.from('{}'), directory, read, put), /checksum/);
  assert.equal(writes, 8);
  await writeFile(authorization.files['source-supplement-catalogue.json'].path, '{}');
  await assert.rejects(prepareSourceSupplement(authorization, release), /file changed/);
});

test('Collection publication rejects missing, extra, unbound and changed authorized files', async t => {
  const data = await collectionFixture(), release = releaseFor(data);
  const { authorization } = await localAuthorization(t, data);
  const missing = { ...authorization, files: { ...authorization.files } };
  delete missing.files['source-supplement-catalogue.schema.json'];
  await assert.rejects(prepareSourceSupplement(missing, release), /file set mismatch/);
  const extra = { ...authorization, files: { ...authorization.files, 'source-supplement.json': authorization.files[data.descriptor.path] } };
  await assert.rejects(prepareSourceSupplement(extra, release), /file set mismatch/);
  const wrongSize = { ...authorization, pointer_descriptor: { ...data.descriptor, bytes: data.descriptor.bytes + 1 } };
  await assert.rejects(prepareSourceSupplement(wrongSize, { ...release, source_supplement: undefined }), /descriptor mismatch/);
  await assert.rejects(prepareSourceSupplement(authorization, { ...release, export_id: 'f'.repeat(64) }), /bind/);
  await assert.rejects(verifyPublishedSourceSupplement({ ...release, export_id: 'f'.repeat(64) }, publicReader(data)), /binding/);
  const changed = { ...authorization, files: { ...authorization.files, [data.descriptor.schema_path]: authorization.files['source-supplement-catalogue.schema.json'] } };
  await assert.rejects(prepareSourceSupplement(changed, release), /descriptor mismatch/);
  assert.throws(() => releaseSchema.parse({ ...release, source_supplement: { ...data.descriptor, bytes: 2_000_001 } }));
  assert.throws(() => releaseSchema.parse({ ...release, source_supplement: { ...data.descriptor, schema_sha256: supplementSchemaHash } }));
  assert.throws(() => releaseSchema.parse({ ...release, source_supplement: { ...data.descriptor, schema_path: 'source-supplement.schema.json' } }));
});

test('Collection publication rejects cross-component evidence and measurement identities', async t => {
  for (const kind of ['evidence', 'measures'] as const) await t.test(kind, async t => {
    const data = await collectionFixture();
    if (kind === 'evidence') {
      data.parts[1].evidence[0].id = data.parts[0].evidence[0].id;
      data.parts[1].records[0].claims[0].evidence_ids = [data.parts[0].evidence[0].id];
    } else {
      const missing = { value: null, status: 'not_reported' as const };
      for (const part of data.parts) {
        const record = part.records[0];
        const evidence = { field: 'Findings', quote: part.evidence[0].quote };
        record.measures.push({ annotation_key: 'shared-measure', label: 'Synthetic measure', value: null, value_status: 'not_reported', metric: 'other', unit: 'other', count_kind: 'unknown', case_class: 'unknown', date_basis: 'unknown', evidence, disease: missing, pathogen: missing, host: missing, geography: missing, period_label: 'Unknown', source_reference: { record_id: record.id, document_id: record.document_id, claim_index: 0, quote_indexes: [0] }, semantic_note: 'Synthetic source scope.' });
      }
      data.collection.counts.measures = 2;
      for (const component of data.collection.components) component.counts.measures = 1;
      for (const document of data.catalogue.documents) document.records[0].measures = 1;
    }
    data.parts.forEach((_, index) => replacePart(data, index));
    seal(data);
    const { authorization } = await localAuthorization(t, data);
    await assert.rejects(prepareSourceSupplement(authorization, releaseFor(data)), new RegExp(`Duplicate collection ${kind} identity`));
    await assert.rejects(verifyPublishedSourceSupplement(releaseFor(data), publicReader(data)), new RegExp(`Duplicate collection ${kind} identity`));
  });
});

test('Collection publication rejects catalogue projections and duplicate component declarations', async t => {
  for (const kind of ['projection', 'duplicate component', 'export binding'] as const) await t.test(kind, async t => {
    const data = await collectionFixture();
    if (kind === 'projection') data.catalogue.documents[0].title = 'Mismatched source title';
    else if (kind === 'duplicate component') data.collection.components[1] = data.collection.components[0];
    else data.collection.components[0].source_export_id = 'f'.repeat(64);
    seal(data);
    const { authorization } = await localAuthorization(t, data);
    await assert.rejects(prepareSourceSupplement(authorization, releaseFor(data)));
    await assert.rejects(verifyPublishedSourceSupplement(releaseFor(data), publicReader(data)));
  });
});

test('Activation preserves either supplement format while base staging remains separate', async () => {
  const data = await collectionFixture(), collectionRelease = releaseFor(data);
  const base = releaseSchema.parse({ ...collectionRelease, source_supplement: undefined });
  const single = releaseSchema.parse({ ...collectionRelease, source_supplement: { version: '0.1.0', source_export_id: collectionRelease.export_id, path: 'source-supplement.json', schema_path: 'source-supplement.schema.json', schema_sha256: supplementSchemaHash, sha256: 'b'.repeat(64), bytes: 10 } });
  requireCurrentSourceSupplement(collectionRelease, structuredClone(collectionRelease));
  assert.throws(() => requireCurrentSourceSupplement(collectionRelease, base), /must include/);
  assert.throws(() => requireCurrentSourceSupplement(collectionRelease, single), /must preserve/);
  assert.throws(() => requireCurrentSourceSupplement(single, collectionRelease), /must preserve/);
  const next = releaseFor(await collectionFixture('c'.repeat(64)));
  requireCurrentSourceSupplement(single, next);
  requireCurrentSourceSupplement(collectionRelease, next);
  assert.throws(() => requireCurrentSourceSupplement(collectionRelease, { ...next, source_supplement: collectionRelease.source_supplement }), /binding/);
  requireSyncAttachments(collectionRelease, { ...next, source_supplement: undefined }, true);
  requireSyncAttachments(collectionRelease, { ...next, source_supplement: undefined }, false);
  assert.throws(() => requireSyncAttachments(collectionRelease, next, true), /exclude undated/);
  assert.throws(() => requireSyncAttachments(collectionRelease, next, false), /exclude undated/);
});
