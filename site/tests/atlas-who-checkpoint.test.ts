import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validateAtlas } from '../scripts/validate-atlas-metrics';
import { createResearch } from '../src/lib/atlas-comparisons';
import { createMetrics, metricValue } from '../src/lib/atlas-metrics';
import { selectView } from '../src/lib/atlas-vendor/1.4/view.mjs';
import { selectorHashes } from '../src/lib/atlas-contract';

test('WHO checkpoint preserves missing cells, cumulative snapshots and capture eligibility', { skip: !process.env.ATLAS_WHO_CHECKPOINT && !process.env.ATLAS_WHO_FINAL }, () => {
  const final = !!process.env.ATLAS_WHO_FINAL;
  const root = process.env.ATLAS_WHO_FINAL ?? process.env.ATLAS_WHO_CHECKPOINT!;
  assert.equal(createHash('sha256').update(readFileSync(root + '/structured/view.mjs')).digest('hex'), selectorHashes['1.4.0']);
  const { bundle } = validateAtlas(root + '/structured', root + '/snapshot.json');
  assert(bundle.contract_version === '1.4.0');
  assert.equal(bundle.records.length, final ? 2098 : 1794);
  assert.equal(bundle.metrics.measures.length, final ? 13083 : 3301);
  const research = createResearch(bundle);
  const ids = new Set(bundle.records.map(r => r.id));
  const view = research.selectedResearch(ids);
  assert.equal(view.one_health!.nodes.length, final ? 264 : 101);
  assert.equal(view.one_health!.relations.length, final ? 60 : 16);
  assert.equal(view.one_health!.coverage.not_reviewed, 1616);
  assert(view.one_health!.nodes.some(n => n.finding === 'agent_not_detected'));
  assert(view.one_health!.relations.some(r => r.basis === 'source_hypothesis'));
  const dated = research.selectedOneHealth(ids, { observation_from: '2026-07-01', observation_until: '2026-07-31' })!;
  assert(dated.undated_nodes.length > 0);
  const lab = bundle.metrics.measures.filter(m => m.annotation_key.includes(':lab_table:'));
  assert.equal(lab.filter(m => m.value === null).length, final ? 2771 : 255);
  assert.equal(lab.filter(m => m.value === 0).length, final ? 998 : 110);
  const metrics = createMetrics(bundle, research.selectedResearch);
  const shown = new Set(metrics.panelMeasures('record', [...ids], ids).map(m => m.measure_id));
  for (const m of lab) {
    assert(shown.has(m.measure_id));
    if (m.value === null) assert.equal(metricValue(m), 'unknown');
    if (m.value === 0) assert.equal(metricValue(m), '0');
  }
  const measures = new Map(bundle.metrics.measures.map(m => [m.measure_id, m]));
  const mpox = view.reviewed_series.filter(s => s.series_id.startsWith('who-mpox-global-'));
  assert.equal(mpox.length, 2);
  for (const s of mpox) {
    assert.equal(s.members.length, final ? 8 : 4);
    assert.equal(s.connections.length, final ? 7 : 3);
    const members = s.members.map(m => measures.get(m.measure_id)!);
    assert(members.every(m => m.count_kind === 'cumulative'));
    const june = members.find(m => m.observation_date === '2026-06-30')!;
    const filtered = research.selectedResearch(new Set([...ids].filter(id => id !== june.source_reference.record_id)));
    const series = filtered.reviewed_series.find(x => x.series_id === s.series_id)!;
    assert.equal(series.members.length, final ? 7 : 3);
    assert.equal(series.connections.length, final ? 5 : 1);
    const edge = series.connections[0];
    assert.equal(measures.get(edge.from_measure_id)!.observation_date, final ? '2025-12-31' : '2026-04-30');
    assert.equal(measures.get(edge.to_measure_id)!.observation_date, final ? '2026-01-31' : '2026-05-31');
  }
  if (final) {
    assert.equal(view.reviewed_series.length, 62);
    assert.equal(view.reviewed_series.reduce((n, s) => n + s.connections.length, 0), 567);
    assert.equal(view.reviewed_chains.length, 11);
    const meningitis = view.reviewed_series.filter(s => s.series_id.startsWith('who-meningitis-weekly-'));
    assert.equal(meningitis.length, 36);
    assert.equal(meningitis.reduce((n, s) => n + s.connections.length, 0), 162);
    for (const series of meningitis) for (const edge of series.connections) {
      const from = measures.get(edge.from_measure_id)!, to = measures.get(edge.to_measure_id)!;
      assert.equal(Date.parse(to.observation_date!) - Date.parse(from.observation_date!), 7 * 86400000);
    }
  }
  const historical = selectView(bundle, bundle.snapshot.publication_from, bundle.snapshot.publication_until, 'publication', '2026-09-28T00:00:00Z');
  const historicalIds = new Set(historical.record_ids);
  const recovered = bundle.records.filter(r => r.capture >= '2026-09-28');
  assert.equal(recovered.length, final ? 474 : 170);
  assert(recovered.every(r => !historicalIds.has(r.id)));
  assert.equal(historical.record_ids.length, 1624);
});
