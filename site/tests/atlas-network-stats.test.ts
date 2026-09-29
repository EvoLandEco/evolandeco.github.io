import { test } from 'node:test';
import assert from 'node:assert/strict';
import { networkStatistics } from '../src/lib/atlas-network-stats';
import type { AtlasLink } from '../src/lib/atlas';

const link = (id: string, from: string, to: string, type: AtlasLink['type'] = 'movement'): AtlasLink => ({
  id, type, directed: type === 'movement', label: id, basis: '', limit: '', support: [[id, 0], [id, 1]],
  from: { label: from, track: '', lat: 0, lon: 0, precision: '' }, to: { label: to, track: '', lat: 0, lon: 0, precision: '' },
});
const countries = new Set(['FR', 'DE', 'NL', 'US', 'CA']);
const endpoints = (edge: AtlasLink) => [edge.from.label.split(','), edge.to.label.split(',')];

test('Country network counts link multiplicity, ties and travel destinations without multiplying claims or ambiguous geography', () => {
  const a = link('a', 'FR', 'DE');
  const stats = networkStatistics([a, a, link('b', 'DE', 'FR'), link('c', 'FR', 'NL', 'shared_event'), link('d', 'US', 'CA'),
    link('hypothesis', 'NL', 'US', 'hypothesis'), link('domestic', 'FR', 'FR'), link('regional', 'FR,DE', 'NL'), link('unknown', 'EU', 'DE')], countries, endpoints);
  assert.equal(stats.weight, 4);
  assert.equal(stats.nodes.length, 5);
  assert.equal(stats.pairs.length, 3);
  assert.deepEqual(stats.hubs.map(n => [n.code, n.strength, n.neighbors.size]), [['FR', 3, 2]]);
  assert.deepEqual(stats.corridors.map(e => [e.codes, e.weight, [...e.records]]), [[['DE', 'FR'], 2, ['a', 'b']]]);
  assert.deepEqual(stats.destinations.map(n => [n.code, n.weight]), [['CA', 1], ['DE', 1], ['FR', 1]]);
  assert.deepEqual(stats.excluded, { hypotheses: 1, geography: 2, domestic: 1 });
  assert.equal(stats.nodes.reduce((sum, n) => sum + n.strength, 0), 2 * stats.weight);
  const tied = networkStatistics([a, link('d', 'US', 'CA')], countries, endpoints);
  assert.equal(tied.hubs.length, 4);
  assert.equal(tied.corridors.length, 2);
  assert.equal(tied.destinations.length, 2);
  const incoming = networkStatistics([a, a, link('in', 'NL', 'DE'), link('out', 'DE', 'FR'),
    link('shared', 'FR', 'NL', 'shared_event'), { ...link('undirected', 'FR', 'NL'), directed: false },
    link('hyp', 'FR', 'NL', 'hypothesis'), link('same', 'NL', 'NL'), link('region', 'FR,DE', 'NL')], countries, endpoints);
  assert.deepEqual(incoming.destinations.map(n => [n.code, n.weight, [...n.records]]), [['DE', 2, ['a', 'in']]]);
  const noTravel = networkStatistics([link('shared', 'FR', 'NL', 'shared_event'), { ...a, directed: false }], countries, endpoints);
  assert.deepEqual(noTravel.destinations, []);
  const empty = networkStatistics([], countries, endpoints);
  assert.equal(empty.weight, 0);
  assert.deepEqual([empty.nodes, empty.hubs, empty.corridors, empty.destinations], [[], [], [], []]);
});
