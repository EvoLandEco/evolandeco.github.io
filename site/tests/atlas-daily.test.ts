import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDaily, dailySelection, pendingDailyDocuments, reportChronology, highlightedReportIds, validateDailyReferences, dailyPins, fetchDaily } from '../src/lib/atlas-daily';
import { selectDaily } from '../src/lib/atlas-vendor/daily/0.2.1/daily-view.mjs';
import { dailyFixture, dailyHash, dailyPointer } from './atlas-daily-fixture';
import type { AtlasRelease } from '../src/lib/atlas-release';
const release = { export_id: 'a'.repeat(64), assets: { 'atlas-site.json': { sha256: 'b'.repeat(64), bytes: 1 }, 'map.json': { sha256: 'c'.repeat(64), bytes: 1 } } } as AtlasRelease;
test('Daily selections preserve bindings, source evidence, cutoffs and exact weekly reconciliation', async () => {
  assert.equal(dailyHash(readFileSync('src/lib/atlas-vendor/daily/0.2.1/daily.schema.json')), dailyPins.schema);
  assert.equal(dailyHash(readFileSync('src/lib/atlas-vendor/daily/0.2.1/daily-view.mjs')), dailyPins.selector);
  const data = dailyFixture(release);
  await validateDaily(data, release, data.base_manifest_sha256);
  for (const mutate of [(d: typeof data) => { d.base_source_export_id = 'b'.repeat(64); }, (d: typeof data) => { d.evidence[0].quote = 'Changed quote'; }, (d: typeof data) => { d.findings[0].document_id = 'missing'; }, (d: typeof data) => { d.watch_items[0].document_ids = ['daily_latest']; }]) {
    const invalid = structuredClone(data); mutate(invalid); await assert.rejects(validateDaily(invalid, release, data.base_manifest_sha256));
  }
  const window: [string, string] = ['2026-10-01', '2026-10-07'];
  assert.equal(dailySelection(data, window, ['france_spf'], ['FR'], data.generated_at).watch_items.length, 1);
  assert.equal(dailySelection(data, window, ['other'], [], data.generated_at).documents.length, 0);
  assert.equal(dailySelection(data, window, [], ['DE'], data.generated_at).documents.length, 0);
  assert.equal(dailySelection(data, ['2026-10-01', '2026-10-06'], [], [], data.generated_at).documents.length, 0);
  assert.equal(selectDaily(data, ...window, 'publication', '2026-10-07T07:59:00Z').documents.length, 0);
  data.documents[0].capture = '2026-10-07T07:00:00Z';
  const earlier = selectDaily(data, ...window, 'publication', '2026-10-07T07:59:00Z');
  assert.equal(earlier.documents[0].title_translation, null); assert.equal(earlier.watch_items.length, 0);
  data.reconciliations.push({ review_id: 'review_daily', weekly_export_id: release.export_id, record_ids: ['weekly_record'], disposition: 'integrated', reason: 'Reviewed and integrated in the weekly source.', reviewed_at: data.knowledge_cutoff, reviewed_by: 'fixture', weekly_inbox_sha256: 'c'.repeat(64) });
  assert.equal(pendingDailyDocuments(dailySelection(data, window, [], [], data.generated_at), new Set(['weekly_record'])).length, 1);
  data.reconciliations[0].weekly_export_id = 'b'.repeat(64);
  assert.equal(pendingDailyDocuments(dailySelection(data, window, [], [], data.generated_at), new Set(['weekly_record'])).length, 2);
});
test('Daily fetch handles absent publication and rejects damaged or mismatched payloads', async t => {
  const data = dailyFixture(release), pointer = dailyPointer(data);
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(JSON.stringify(url.endsWith('current.json') ? pointer : data), { status: 200 }));
  assert.equal((await fetchDaily(release, data.base_manifest_sha256))?.daily_id, data.daily_id);
  pointer.base_manifest_sha256 = 'f'.repeat(64);
  await assert.rejects(fetchDaily(release, data.base_manifest_sha256));
  t.mock.restoreAll(); t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 404 }));
  assert.equal(await fetchDaily(release, data.base_manifest_sha256), undefined);
});
test('Watch cards remain selected after review deadlines until a reviewed release retires them', async () => {
  const data = dailyFixture(release), window: [string, string] = ['2026-10-01', '2026-10-07'];
  for (const at of [data.watch_items[0].review_due_at, '2027-01-01T12:00:00Z']) {
    const selection = dailySelection(data, window, [], [], at);
    assert.equal(selection.watch_items.length, 1);
    assert.equal(selection.overdue_watch_items.length, 1);
    assert.equal(selection.documents.length, 2);
    assert.equal(dailySelection(data, window, ['other'], [], at).watch_items.length, 0);
    assert.equal(dailySelection(data, window, [], ['DE'], at).watch_items.length, 0);
    assert.equal(dailySelection(data, ['2026-10-01', '2026-10-06'], [], [], at).watch_items.length, 0);
  }
  assert.equal(dailySelection(data, window, [], [], '2026-10-07T07:59:00Z').watch_items.length, 0);
  const retired = structuredClone(data);
  retired.watch_items = [];
  assert.equal(dailySelection(retired, window, [], [], '2027-01-01T12:00:00Z').watch_items.length, 0);
  assert.equal(data.source_coverage.length, 1);
  assert.equal(selectDaily(data, ...window, 'publication', data.knowledge_cutoff).watch_items.length, 1);
  data.watch_assessments[0].key_facts[0].finding_ids = ['missing'];
  data.watch_items = structuredClone(data.watch_assessments);
  await assert.rejects(validateDaily(data, release, data.base_manifest_sha256), /watch fact evidence/);
});
test('Daily publication validates the sealed files and the weekly browser binding', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { prepareDailyRelease } = await import('../scripts/publish-atlas-daily');
  const directory = await mkdtemp(join(tmpdir(), 'atlas-daily-'));
  try {
    const data = dailyFixture(release);
    const browserBytes = Buffer.from(JSON.stringify({ source_export_id: release.export_id, source: { manifest: { sha256: data.base_manifest_sha256 }, site: { sha256: data.base_site_sha256 } } }));
    const base = { ...release, browser: { transport_version: '0.3.0' as const, manifest: { sha256: dailyHash(browserBytes), bytes: browserBytes.length } } };
    const files = { 'daily.json': Buffer.from(JSON.stringify(data)), 'daily.schema.json': readFileSync('src/lib/atlas-vendor/daily/0.2.1/daily.schema.json'), 'daily-view.mjs': readFileSync('src/lib/atlas-vendor/daily/0.2.1/daily-view.mjs'), 'validation.json': Buffer.from(JSON.stringify({ status: 'valid', daily_id: data.daily_id, base_source_export_id: release.export_id, documents: 2, findings: 1, watch_items: 1, weekly_review_pending: 2 })) };
    for (const [name, bytes] of Object.entries(files)) await writeFile(join(directory, name), bytes);
    await writeFile(join(directory, 'manifest.json'), JSON.stringify({ daily_version: '0.2.1', daily_id: data.daily_id, base_source_export_id: release.export_id, files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { sha256: dailyHash(bytes), bytes: bytes.length }])) }));
    assert.equal((await prepareDailyRelease(directory, base, browserBytes)).pointer.daily_id, data.daily_id);
    await assert.rejects(prepareDailyRelease(directory, base, Buffer.from('{}')));
    await writeFile(join(directory, 'daily.json'), '{}');
    await assert.rejects(prepareDailyRelease(directory, base, browserBytes));
  } finally { await rm(directory, { recursive: true }); }
});

test('Exact daily document identities share one report entry with their weekly records', () => {
  const daily = dailyFixture(release).documents;
  const records = [{ id: 'record', document_id: daily[0].id }] as import('../src/lib/atlas').AtlasRecord[];
  const entries = reportChronology([records], daily, () => ({ publication: '2026-10-07', capture: daily[0].capture }));
  assert.equal(entries.length, 2);
  assert.equal(entries.find(entry => entry.id === daily[0].id)?.records[0], records[0]);
  assert.equal(entries.find(entry => entry.id === daily[0].id)?.dailyVersions[0], daily[0]);
});

test('Publisher version bindings retain scientific and daily versions without claiming review equivalence', () => {
  const data = dailyFixture(release);
  data.documents[0].base_document_ids = ['weekly_a', 'weekly_b'];
  data.documents[0].channel_id = 'spf-channel';
  const base = { documents: [{ id: 'weekly_a' }, { id: 'weekly_b' }], channels: [{ id: 'spf-channel', acquisition_source: 'france_spf' }] } as Parameters<typeof validateDailyReferences>[1];
  validateDailyReferences(data, base);
  const records = ['weekly_a', 'weekly_b'].map(id => [{ id: id + '_record', document_id: id }] as import('../src/lib/atlas').AtlasRecord[]);
  const entries = reportChronology(records, data.documents, () => ({ publication: '2026-10-07', capture: data.generated_at }));
  assert.equal(entries.length, 2);
  const shared = entries.find(entry => entry.weeklyVersions.length)!;
  assert.equal(shared.weeklyVersions.length, 2); assert.equal(shared.records.length, 2);
  assert.equal(shared.dailyVersions[0].processing_status, 'weekly_review_pending');
  assert.deepEqual([...highlightedReportIds(entries, ['weekly_b_record'], [])], [shared.id]);
  assert.deepEqual([...highlightedReportIds(entries, [], [data.documents[0].id, 'weekly_a', 'weekly_b'])], [shared.id]);
  assert.deepEqual([...highlightedReportIds(entries, [], [data.documents[1].id])], [data.documents[1].id]);
  assert.equal(highlightedReportIds(entries, [], []).size, 0);
  assert.equal(dailySelection(data, ['2026-10-01', '2026-10-07'], ['spf-channel'], [], data.generated_at).documents.length, 1);
  assert.equal(dailySelection(data, ['2026-10-01', '2026-10-07'], ['france_spf'], [], data.generated_at).documents.length, 2);
  data.documents[0].base_document_ids.push('unknown');
  assert.throws(() => validateDailyReferences(data, base));
});
