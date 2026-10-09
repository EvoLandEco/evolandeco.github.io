import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { collectionFixture } from './atlas-supplement-collection-fixture';
import fixture from './atlas-fixture.json';
import { releaseSchema } from '../src/lib/atlas-release';
import { supplementCollectionSchemaHash, supplementCatalogueSchemaHash, validateSupplementCollection, validateSupplementCatalogue, validateSupplementComponent, fetchSupplementCollection, createSupplementComponentStore } from '../src/lib/atlas-supplement-collection';

test('Collection schema pins, catalogue identities and payload projections match the producer', async () => {
  for (const [name, expected] of [['collection', supplementCollectionSchemaHash], ['catalogue', supplementCatalogueSchemaHash]]) {
    const raw = await readFile(new URL(`../src/lib/atlas-vendor/supplement-collection/0.1/source-supplement-${name}.schema.json`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), expected);
  }
  const { collection, catalogue, parts } = await collectionFixture();
  validateSupplementCollection(collection, collection.source_export_id);
  await validateSupplementCatalogue(catalogue, collection);
  await validateSupplementComponent(parts[0], collection.components[0], catalogue);
  for (const change of [
    (value: typeof collection) => { value.source_export_id = 'f'.repeat(64); },
    (value: typeof collection) => { value.components.push(value.components[0]); },
    (value: typeof collection) => { value.components[0].source_export_id = 'f'.repeat(64); },
    (value: typeof collection) => { value.components[0].schema_sha256 = 'f'.repeat(64); },
    (value: typeof collection) => { value.counts.documents++; },
    (value: typeof collection) => { value.catalogue.schema_sha256 = 'f'.repeat(64); },
  ]) { const value = structuredClone(collection); change(value); assert.throws(() => validateSupplementCollection(value, collection.source_export_id)); }
  for (const change of [
    (value: typeof catalogue) => { value.documents.push(value.documents[0]); },
    (value: typeof catalogue) => { value.documents[1].records[0].id = value.documents[0].records[0].id; },
    (value: typeof catalogue) => { value.documents.pop(); },
    (value: typeof catalogue) => { value.documents[0].component_id = 'supplement_' + 'f'.repeat(24); },
    (value: typeof catalogue) => { value.documents[0].records[0].claims++; },
    (value: typeof catalogue) => { value.documents[0].url = 'javascript:alert(1)'; },
    (value: typeof catalogue) => { value.source_export_id = 'f'.repeat(64); },
  ]) { const value = structuredClone(catalogue); change(value); await assert.rejects(validateSupplementCatalogue(value, collection)); }
  const wrongTitle = structuredClone(parts[0]); wrongTitle.documents[0].title += ' changed';
  await assert.rejects(validateSupplementComponent(wrongTitle, collection.components[0], catalogue), /projection/);
  await assert.rejects(validateSupplementComponent(parts[1], collection.components[0], catalogue), /projection/);
  const wrongQuote = structuredClone(parts[0]); wrongQuote.evidence[0].quote += ' changed';
  await assert.rejects(validateSupplementComponent(wrongQuote, collection.components[0], catalogue), /quotation/);
});

test('Collection discovery downloads only metadata, rejects corruption and honors cancellation', async t => {
  const { descriptor, files, catalogue } = await collectionFixture(fixture.release.export_id);
  const release = releaseSchema.parse({ ...fixture.release, source_supplement: descriptor });
  const requests: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => { requests.push(url); return new Response(new Uint8Array(files[url.split('/').at(-1)!])); });
  const loaded = await fetchSupplementCollection(release);
  assert.deepEqual(loaded.catalogue, catalogue);
  assert.deepEqual(requests.map(url => url.split('/').at(-1)), ['source-supplement-collection.json', 'source-supplement-catalogue.json']);
  await assert.rejects(fetchSupplementCollection(release, AbortSignal.abort()), { name: 'AbortError' });
  assert.equal(requests.length, 2);
  files['source-supplement-catalogue.json'] = Buffer.from('{}');
  await assert.rejects(fetchSupplementCollection(release), /checksum/);
});

test('Component identities use the producer Unicode code point ordering', async () => {
  const { collection, catalogue } = await collectionFixture();
  const doc = catalogue.documents[0], component = collection.components[0];
  doc.records = [{ ...doc.records[0], id: 'record_😀' }, { ...doc.records[0], id: 'record_\ue000', claims: 0 }];
  const identity = JSON.stringify({ documents: [doc.id], records: ['record_\ue000', 'record_😀'] });
  component.id = doc.component_id = `supplement_${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
  component.counts.records++; collection.counts.records++;
  validateSupplementCollection(collection, collection.source_export_id);
  await validateSupplementCatalogue(catalogue, collection);
});

test('Component leases share requests, cancel unused work and release cached payloads', async t => {
  const { descriptor, collection, catalogue, files } = await collectionFixture(fixture.release.export_id);
  const release = releaseSchema.parse({ ...fixture.release, source_supplement: descriptor });
  let requests = 0, allow!: () => void, cancelled = false;
  const blocked = new Promise<void>(resolve => { allow = resolve; });
  const request = t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    requests++;
    options.signal?.addEventListener('abort', () => { cancelled = true; }, { once: true });
    await blocked;
    options.signal?.throwIfAborted();
    return new Response(new Uint8Array(files[`supplements/${url.split('/supplements/')[1]}`]));
  });
  const store = createSupplementComponentStore(release, collection, catalogue), controller = new AbortController();
  const first = store.acquire(collection.components[0].id, controller.signal), second = store.acquire(collection.components[0].id);
  const rejected = assert.rejects(first, { name: 'AbortError' }); controller.abort(); await rejected;
  assert.equal(cancelled, false);
  allow();
  const lease = await second;
  assert.equal(requests, 1);
  assert.equal(store.stats().cachedBytes, collection.components[0].bytes);
  lease.release(); lease.release();
  assert.deepEqual(store.stats(), { cachedBytes: 0, components: 0 });
  const again = await store.acquire(collection.components[0].id); assert.equal(requests, 2); again.release();
  request.mock.mockImplementation(async () => new Response('{}'));
  await assert.rejects(store.acquire(collection.components[1].id), /checksum/);
  assert.equal(store.stats().components, 0);
  store.dispose();
  await assert.rejects(store.acquire(collection.components[0].id), { name: 'AbortError' });
});
