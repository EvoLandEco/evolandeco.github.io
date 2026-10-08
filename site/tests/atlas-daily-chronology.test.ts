import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailySelection, reportChronology, reportPublicationMonth } from '../src/lib/atlas-daily';
import { formatDate, type AtlasRecord } from '../src/lib/atlas';
import type { AtlasRelease } from '../src/lib/atlas-release';
import { dailyFixture } from './atlas-daily-fixture';

const release = { export_id: 'a'.repeat(64), assets: { 'atlas-site.json': { sha256: 'b'.repeat(64), bytes: 1 }, 'map.json': { sha256: 'c'.repeat(64), bytes: 1 } } } as AtlasRelease;

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
