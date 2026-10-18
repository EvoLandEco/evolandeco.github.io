import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailySelection, pendingDailyDocuments, reportChronology, reportPublicationMonth, highlightedReportIds } from '../src/lib/atlas-daily';
import { formatDate, type AtlasRecord } from '../src/lib/atlas';
import type { AtlasRelease } from '../src/lib/atlas-release';
import { dailyFixture } from './atlas-daily-fixture';

const release = { export_id: 'a'.repeat(64), assets: { 'atlas-site.json': { sha256: 'b'.repeat(64), bytes: 1 }, 'map.json': { sha256: 'c'.repeat(64), bytes: 1 } } } as AtlasRelease;

test('Historical SPF publication identity survives superseded daily captures and report filtering', () => {
  const data = dailyFixture(release);
  const memberIds = ['spf_original', 'spf_capture', 'spf_alternate_url'];
  const records = memberIds.map(document_id => Array.from({ length: 9 }, (_, index) => ({ id: `${document_id}:${index}`, document_id })) as AtlasRecord[]);
  const dates = (id: string) => ({ publication: '2026-10-07', capture: `2026-10-07T0${memberIds.indexOf(id) + 5}:00:00Z` });
  const historical = { ...data.documents[0], id: 'superseded_daily_capture', base_document_ids: memberIds };
  assert.equal(reportChronology(records, [], dates, [historical]).length, 1);
  const publicationBindings = [{ document_versions: memberIds.map(document_id => ({ document_id, raw_sha256: 'a'.repeat(64), source_text_sha256: 'b'.repeat(64) })), assertion_ids: ['assertion'], comparison_ids: ['comparison'], evidence_ids: ['evidence'], reason: 'Reviewed versions of the same publisher edition.', reviewed_at: data.generated_at, reviewed_by: 'fixture' }];
  data.documents = [
    { ...data.documents[0], id: 'spf_changed', review_id: 'changed_review', raw_sha256: '1'.repeat(64), source_text_sha256: '2'.repeat(64), finding_ids: [], base_document_ids: memberIds.slice(0, 2) },
    { ...data.documents[1], id: 'spf_changed_alternate', review_id: 'changed_alternate_review', raw_sha256: '3'.repeat(64), source_text_sha256: '4'.repeat(64), base_document_ids: memberIds.slice(2) },
  ];
  data.findings = []; data.evidence = []; data.watch_items = []; data.watch_assessments = [];
  const selected = dailySelection(data, ['2026-10-01', '2026-10-07'], [], [], data.generated_at);
  const pending = pendingDailyDocuments(selected, new Set(records.flat().map(record => record.id)));
  assert.equal(pending.length, 2);
  const entries = reportChronology(records, pending, dates, data.documents, publicationBindings);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].records.length, 27);
  assert.equal(entries[0].weeklyVersions.length, 3);
  assert.deepEqual(entries[0].dailyVersions.map(document => document.processing_status), ['weekly_review_pending', 'weekly_review_pending']);
  assert.deepEqual(new Set(entries[0].records.map(record => record.id)), new Set(records.flat().map(record => record.id)));
  for (const document of pending) assert.deepEqual([...highlightedReportIds(entries, [], [document.id, ...document.base_document_ids])], [entries[0].id]);
  const filtered = reportChronology([records[2]], [pending[1]], dates, data.documents, publicationBindings);
  assert.equal(filtered.length, 1);
  assert.deepEqual(filtered[0].records, records[2]);
  assert.deepEqual(filtered[0].dailyVersions, [pending[1]]);
  assert.equal(reportChronology(records, [], dates, data.documents, publicationBindings).length, 1);
  assert.equal(reportChronology([], [], dates, data.documents, publicationBindings).length, 0);
  assert.equal(dailySelection(data, ['2026-10-08', '2026-10-08'], [], [], data.generated_at).documents.length, 0);
  assert.equal(dailySelection(data, ['2026-10-01', '2026-10-07'], ['other-source'], [], data.generated_at).documents.length, 0);
});

test('Identical publisher captures share one entry without merging dates, changed content or sources', () => {
  const records = ['older', 'newer'].map(document_id => [{ id: `${document_id}:0`, document_id }] as AtlasRecord[]);
  const document = { channel_id: 'who-don', url: 'https://example.org/report', content_url: 'https://example.org/report.pdf', publication: '2026-09-25T12:00:00Z', capture: '2026-09-26T12:00:00Z', raw_sha256: 'a'.repeat(64), text_sha256: 'b'.repeat(64) };
  const newer = { ...document, capture: '2026-09-27T12:00:00Z' };
  const entries = reportChronology(records, [], id => id === 'older' ? document : newer);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].id, 'newer');
  assert.deepEqual(entries[0].weeklyVersions, [records[1], records[0]]);
  assert.deepEqual(entries[0].records, [...records[1], ...records[0]]);
  assert.deepEqual([...highlightedReportIds(entries, ['older:0'], [])], ['newer']);
  for (const field of ['channel_id', 'url', 'content_url', 'publication', 'raw_sha256', 'text_sha256'] as const) {
    for (const value of ['', field === 'publication' ? '2026-09-24T12:00:00Z' : 'different']) {
      const changed = { ...newer, [field]: value };
      assert.equal(reportChronology(records, [], id => id === 'older' ? document : changed).length, 2, field);
    }
  }
  const filtered = reportChronology([records[0]], [], () => document);
  assert.equal(filtered.length, 1);
  assert.deepEqual(filtered[0].records, records[0]);
});

test('Report chronology orders instants across offsets and fractional precision', () => {
  const document = dailyFixture(release).documents[1];
  const documents = [
    { ...document, id: 'offset', publication: '2026-10-08T00:15:00+02:00' },
    { ...document, id: 'utc', publication: '2026-10-07T23:00:00Z' },
    { ...document, id: 'fraction', publication: '2026-10-07T23:00:00.100Z' },
    { ...document, id: 'day', publication: '2026-10-08' },
    { ...document, id: 'undated', publication: null },
  ];
  assert.deepEqual(reportChronology([], documents, () => { throw new Error('No weekly documents'); }).map(entry => entry.id), ['day', 'fraction', 'utc', 'offset', 'undated']);
  const versions = [
    { ...document, id: 'older', publication: '2026-10-07T22:00:00Z', capture: '2026-10-08T00:15:00+02:00', base_document_ids: ['base'] },
    { ...document, id: 'newer', publication: '2026-10-08T00:00:00+02:00', capture: '2026-10-07T23:00:00Z', base_document_ids: ['base'] },
  ];
  assert.deepEqual(reportChronology([], versions, () => { throw new Error('No weekly documents'); })[0].dailyVersions.map(version => version.id), ['newer', 'older']);
});

test('Daily display and monthly counts use the same Amsterdam dates as daily selection', () => {
  const data = dailyFixture(release);
  data.documents[0].publication = '2026-09-30T23:30:00Z';
  const selection = dailySelection(data, ['2026-10-01', '2026-10-01'], [], [], data.generated_at);
  assert.deepEqual(selection.documents.map(document => document.id), ['daily_doc']);
  assert.equal(formatDate(selection.documents[0].publication!, 'Europe/Amsterdam'), '1 Oct 2026');
  assert.equal(formatDate('2026-01-31T23:30:00Z', 'Europe/Amsterdam'), '1 Feb 2026');
  assert.equal(formatDate('2026-10-01', 'Europe/Amsterdam'), '1 Oct 2026');
  const [daily] = reportChronology([], selection.documents, () => { throw new Error('No weekly documents'); });
  assert.equal(reportPublicationMonth(daily), '2026-10');
  const records = [{ id: 'record', document_id: 'scientific' }] as AtlasRecord[];
  const [weekly] = reportChronology([records], [], () => ({ publication: '2026-09-30T23:30:00Z', capture: data.generated_at }));
  assert.equal(formatDate(weekly.publication), '30 Sept 2026');
  assert.equal(reportPublicationMonth(weekly), '2026-09');
});
