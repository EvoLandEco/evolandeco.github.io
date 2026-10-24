import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkSummary, networkLayer, type NetworkLayer } from '../src/lib/atlas-network-summary';
import type { AtlasLink, AtlasRecord } from '../src/lib/atlas';
import { bundle as fixture } from './atlas-fixture';

const row = (id: string, document = id, publication = '2026-01-15', capture = '2026-02-03'): AtlasRecord => ({ id, document_id: document, publication, capture,
  item_index: 0, track: 'topic', source: 'source', title: id, url: '', date_basis: 'publication', conflict: false });
const link = (id: string, from: string, to: string, records = [id], type: AtlasLink['type'] = 'movement', directed = true): AtlasLink => ({
  id, type, directed, label: id, basis: '', limit: '', support: records.map(id => [id, 0]),
  from: { label: from, lat: 0, lon: 0, track: '', precision: '' }, to: { label: to, lat: 0, lon: 0, track: '', precision: '' },
});
function input(links: AtlasLink[], rows: AtlasRecord[], layer: NetworkLayer = 'movement_directed') {
  const bundle: Parameters<typeof networkSummary>[0]['bundle'] = { ...fixture, areas: ['FR', 'DE', 'NL', 'US', 'CA', 'NA'].map(code => ({ code, code_system: 'ISO_3166_1_alpha_2', label: code, meaning: 'reporting_location_identifier' })),
    documents: [...new Set(rows.map(row => row.document_id))].map((id, i) => ({ ...fixture.documents[0], id, channel_id: i % 2 ? 'two' : 'one' })),
    channels: [{ ...fixture.channels[0], id: 'one', name: 'One', organization_id: 'org' }, { ...fixture.channels[0], id: 'two', name: 'Two', organization_id: 'org' }], location_memberships: [],
  };
  return { links, rows, bundle, layer, countriesForLink: (link: AtlasLink) => [link.from.label.split(','), link.to.label.split(',')],
    membershipIds: new Set<string>(), includeContext: false, basis: 'publication' as const, window: ['2026-01-01', '2026-02-28'] as const };
}

test('Statements, claims, report entries and documents retain separate counting units', () => {
  const a = { ...link('a', 'FR', 'DE', ['r1', 'r2']), support: [['r1', 0], ['r1', 1], ['r2', 0]] as [string, number][] };
  const stats = networkSummary(input([a, a, link('b', 'FR', 'NL', ['r3']), link('outside', 'NL', 'US', ['r1', 'missing'])], [row('r1', 'doc'), row('r2', 'doc'), row('r3', 'doc'), row('unlinked', 'other')]));
  assert.equal(stats.links.length, 2);
  assert.equal(stats.records.length, 3);
  assert.equal(stats.documents.length, 1);
  assert.equal(stats.selectedDocuments, 2);
  assert.equal(stats.cells.length, 1);
  assert.equal(stats.cells[0].documents.length, 1);
  assert.equal(stats.pairs.reduce((n, pair) => n + pair.documents.length, 0), 2);
  assert.equal(stats.countries.find(country => country.code === 'FR')!.neighbors.size, 2);
  assert.equal(stats.organizations.length, 1);
  assert.equal(stats.sources[0].sourceDocuments, 1);
});

test('Direction, reverse pairs, self loops and relationship types remain distinct', () => {
  const links = [link('out', 'FR', 'DE'), link('back', 'DE', 'FR'), link('domestic', 'FR', 'FR'),
    link('unspecified', 'FR', 'DE', ['unspecified'], 'movement', false), link('shared', 'DE', 'FR', ['shared'], 'shared_event', false), link('hypothesis', 'FR', 'DE', ['hypothesis'], 'hypothesis', false)];
  const rows = links.map(edge => row(edge.id));
  assert.deepEqual(links.map(networkLayer), ['movement_directed', 'movement_directed', 'movement_directed', 'movement_unspecified', 'shared_event', 'hypothesis']);
  const stats = networkSummary(input(links, rows));
  assert.equal(stats.pairs.length, 2);
  assert.equal(stats.domestic.links.length, 1);
  assert.equal(stats.cells[0].links.length, 3);
  const fr = stats.countries.find(country => country.code === 'FR')!;
  assert.deepEqual([fr.links.length, fr.neighbors.size, fr.incoming, fr.outgoing], [3, 1, 1, 1]);
  for (const layer of ['movement_unspecified', 'shared_event', 'hypothesis'] as const) assert.equal(networkSummary(input(links, rows, layer)).links.length, 1);
  const both = [link('x', 'US', 'FR', ['x'], 'shared_event', false), link('y', 'FR', 'US', ['y'], 'shared_event', false)];
  const undirected = networkSummary(input(both, both.map(edge => row(edge.id)), 'shared_event'));
  assert.equal(undirected.pairs.length, 1);
  assert.equal(undirected.cells.length, 1);
});

test('Explicit geography preserves Namibia and excludes ambiguous endpoints without losing evidence totals', () => {
  const links = [link('a', 'NA', 'FR'), link('b', 'FR,DE', 'US'), link('c', 'Unknown', 'NL'), link('d', 'US', 'CA')];
  const stats = networkSummary(input(links, links.map(edge => row(edge.id))));
  assert.equal(stats.links.length, 4);
  assert.equal(stats.unresolved.links.length, 2);
  assert.equal(stats.cells.reduce((n, cell) => n + cell.links.length, 0) + stats.unresolved.links.length, 4);
  assert.equal(stats.countries.some(country => country.code === 'NA'), true);
  assert.deepEqual(stats.components.map(component => component.length), [2, 2]);
});

test('Reporting chronology uses latest complete support, the chosen date basis and zero months', () => {
  const links = [link('a', 'FR', 'DE', ['old', 'new']), link('b', 'NL', 'FR', ['missing-date'])];
  const rows = [row('old', 'one', '2026-01-02'), row('new', 'two', '2026-02-05'), row('missing-date', 'three', '')];
  const args = input(links, rows);
  const stats = networkSummary({ ...args, window: ['2026-01-02', '2026-03-04'] });
  assert.deepEqual(stats.chronology.map(month => [month.month, month.links.length, month.documents.length, month.partial]), [
    ['2026-01', 0, 0, true], ['2026-02', 1, 2, false], ['2026-03', 0, 0, true],
  ]);
  assert.equal(stats.undated.length, 1);
  assert.equal(networkSummary({ ...args, basis: 'capture' }).chronology[1].links.length, 2);
  assert.equal(networkSummary({ ...args, rows: rows.filter(row => row.id !== 'old') }).links.length, 1);
});

test('Reported countries without links respect eligible memberships and context selection', () => {
  const args = input([], [row('r1')]);
  const membership = (id: string, area_code: string, role: 'occurrence' | 'context', support = ['r1']) => ({ ...fixture.location_memberships[0], id, area_code, role, record_id: 'r1', eligibility: { ...fixture.location_memberships[0].eligibility, record_ids: support } });
  args.bundle.location_memberships = [membership('a', 'FR', 'occurrence'), membership('b', 'NL', 'context'), membership('c', 'DE', 'occurrence', ['r1', 'missing'])];
  args.membershipIds = new Set(['a', 'b', 'c']);
  const stats = networkSummary(args);
  assert.deepEqual(stats.unlinked.map(country => country.code), ['FR']);
  assert.equal(stats.selectedDocuments, 1);
  assert.equal(stats.documents.length, 0);
  assert.deepEqual(networkSummary({ ...args, includeContext: true }).unlinked.map(country => country.code), ['FR', 'NL']);
  const empty = networkSummary(input([], []));
  assert.deepEqual([empty.countries.length, empty.pairs.length, empty.cells.length, empty.components.length, empty.selectedDocuments], [0, 0, 0, 0, 0]);
});
