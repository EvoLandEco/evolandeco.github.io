import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { releaseSchema } from '../src/lib/atlas-release';
import fixture from './atlas-fixture.json';
import { intelligenceSchema, fetchAtlasIntelligence } from '../src/lib/atlas-intelligence';

test('The Intelligence consumer preserves the producer payload and rejects unsupported claims', { skip: !process.env.ATLAS_INTELLIGENCE_FILE }, () => {
  const bytes = readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!);
  const raw = JSON.parse(bytes.toString('utf8'));
  const data = intelligenceSchema.parse(raw);
  assert.deepEqual(data, raw);
  const ensemble = data.methods.find(method => method.id === 'ensemble_median');
  assert.ok(ensemble && 'components' in ensemble);
  assert.deepEqual(ensemble.components.map(component => component.model_id), ['random_walk', 'recent_changes', 'gamma_poisson']);
  assert.ok(ensemble.components.every(component => component.weight === 1 / 3));
  assert.equal(intelligenceSchema.safeParse({ ...data, methods: data.methods.map(method => method === ensemble ? { ...method, components: ensemble.components.slice(1) } : method) }).success, false);
  assert.equal(intelligenceSchema.safeParse({ ...data, methods: data.methods.map(method => method === ensemble ? { ...method, require_all_components: false } : method) }).success, false);

  if (process.env.ATLAS_INTELLIGENCE_SHA256) assert.equal(createHash('sha256').update(bytes).digest('hex'), process.env.ATLAS_INTELLIGENCE_SHA256);
  assert.equal(intelligenceSchema.safeParse({ ...data, time_basis: 'real_time' }).success, false);
  assert.equal(intelligenceSchema.safeParse({ ...data, risk_profiles: data.risk_profiles.map(profile => ({ ...profile, probability: .8 })) }).success, false);
  assert.equal(intelligenceSchema.safeParse({ ...data, sources: data.sources.map(source => ({ ...source, url: 'javascript:alert(1)' })) }).success, false);
});


test('Published Intelligence requires verified bytes and matching dataset identity', { skip: !process.env.ATLAS_INTELLIGENCE_FILE }, async t => {
  const bytes = readFileSync(process.env.ATLAS_INTELLIGENCE_FILE!);
  const data = intelligenceSchema.parse(JSON.parse(bytes.toString()));
  const asset = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  const release = releaseSchema.parse({ ...fixture.release, export_id: data.source_export_id,
    selector_sha256: data.input_identity.selector_sha256,
    assets: { ...fixture.release.assets, 'atlas-site.json': { ...fixture.release.assets['atlas-site.json'], sha256: data.input_identity.site_sha256 } },
    intelligence: { experiment_id: data.experiment_id, schema_version: data.schema_version, asset } });
  const urls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => { urls.push(url); return new Response(bytes); });
  assert.deepEqual(await fetchAtlasIntelligence(release), { data, digest: asset.sha256 });
  assert.match(urls[0], new RegExp(`/intelligence/${data.experiment_id}/intelligence.json$`));
  await assert.rejects(fetchAtlasIntelligence({ ...release, export_id: 'a'.repeat(64) }), /does not match/);
  await assert.rejects(fetchAtlasIntelligence({ ...release, selector_sha256: 'a'.repeat(64) }), /does not match/);
  await assert.rejects(fetchAtlasIntelligence({ ...release, intelligence: { ...release.intelligence!, experiment_id: 'a'.repeat(64) } }), /does not match/);
  await assert.rejects(fetchAtlasIntelligence({ ...release, intelligence: { ...release.intelligence!, asset: { ...asset, sha256: 'a'.repeat(64) } } }), /checksum/);
  assert.deepEqual(await fetchAtlasIntelligence({ ...release, intelligence: undefined }), { error: 'No validated analysis is published for this dataset.' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(fetchAtlasIntelligence(release, controller.signal), { name: 'AbortError' });
});
