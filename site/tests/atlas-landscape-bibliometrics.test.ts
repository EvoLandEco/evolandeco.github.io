import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cosine, median, reportingProfiles, reportNeighbours, sourceAffinities, themeRoles } from '../src/lib/atlas-landscape-bibliometrics';
import type { EvidenceLandscape } from '../src/lib/atlas-evidence-landscape';

function fixture(): EvidenceLandscape {
  return {
    version: 1, export_id: 'a'.repeat(64), scope: { publication_from: '2026-01-01', publication_until: '2026-01-31', capture_until: '2026-02-01' },
    labels: ['A', 'B', 'C', 'D', 'Unused'].map(id => ({ id, name: id })), sources: ['One', 'Two'].map(id => ({ id, name: id })),
    documents: [[0, 1], [0, 1, 2], [0, 3]].map((labels, i) => ({ id: `d${i}`, title: `Report ${i}`, date: `2026-01-0${i + 1}`, url: `https://example.org/${i}`, source: i ? 1 : 0, labels, entries: 1 })),
    bundles: [], pairs: [], removals: [], months: [], null_model: { draws: 1, strata: 1, mutable_strata: 1, pairs: [] },
  };
}
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('Cosine is scale invariant and handles zero vectors without inventing similarity', () => {
  close(cosine([1, 2], [3, 6]), 1);
  close(cosine([1, 0], [0, 1]), 0);
  close(cosine([0, 0], [0, 0]), 0);
  close(cosine([1, 2], [2, 1]), .8);
});

test('Report profiles use binary IDF weights and source profiles give each document one unit', () => {
  const profiles = reportingProfiles(fixture()), b = Math.log(3 / 2), c = Math.log(3);
  assert.deepEqual(profiles.documents[0], [0, b, 0, 0, 0]);
  assert.deepEqual(profiles.sources[0], [0, b / 2, 0, 0, 0]);
  assert.deepEqual(profiles.sources[1], [0, b / 3, c / 3, c / 2, 0]);
  close(cosine(profiles.documents[0], profiles.documents[1]), b / Math.hypot(b, c));
});

test('Neighbours preserve exact shared labels, exclude the seed and honour publisher scope', () => {
  const data = fixture(), profiles = reportingProfiles(data);
  const neighbours = reportNeighbours(data, profiles.documents, 0, true);
  assert.equal(neighbours.length, 1);
  assert.deepEqual(neighbours[0].labels, [0, 1]);
  assert.equal(neighbours[0].document, 1);
  data.documents[1].source = 0;
  assert.deepEqual(reportNeighbours(data, profiles.documents, 0, true), []);
  assert.equal(reportNeighbours(data, profiles.documents, 0, false).length, 1);
});

test('Source affinity is symmetric and reports the shared labels independently of their IDF', () => {
  const data = fixture(), profiles = reportingProfiles(data);
  const forward = sourceAffinities(data, profiles.sources, 0)[0], reverse = sourceAffinities(data, profiles.sources, 1)[0];
  close(forward.similarity, reverse.similarity);
  assert.deepEqual(forward.labels, [0, 1]);
  assert.equal(forward.source, 1);
});

test('Theme roles count undirected internal edges once and external edges for both incident groups', () => {
  const data = fixture();
  const roles = themeRoles(data, { month: '2026-01', documents: 3, edges: [[0, 1, 2], [1, 2, 1]], groups: [
    { id: 'a', identity: 1, labels: [0, 1], documents: [0, 1] },
    { id: 'b', identity: 2, labels: [2], documents: [1] },
    { id: 'c', identity: 0, labels: [3], documents: [2] },
  ] });
  assert.equal(roles.length, 2);
  assert.equal(roles[0].centrality, 20);
  assert.equal(roles[0].density, 100);
  assert.equal(roles[1].centrality, 20);
  assert.equal(roles[1].density, 0);
  assert.deepEqual(roles[0].documents, [0, 1]);
  assert.deepEqual(themeRoles(data, { month: '2026-01', documents: 0, edges: [], groups: [] }), []);
});

test('Median boundaries preserve values and handle odd, even and empty groups', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([9, 1, 3, 5]), 4);
  assert.equal(median([]), 0);
});
