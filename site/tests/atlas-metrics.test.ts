import { test } from "node:test";
import assert from "node:assert/strict";
import { bundle, atlas, metrics, measures, panelMeasures, compactPanelFigures } from "./atlas-fixture";
import { createResearch } from "../src/lib/atlas-comparisons";
import { createMetrics, metricValue } from "../src/lib/atlas-metrics";

test("Metric panels preserve conflicts and exclude evidence outside the reporting window", () => {
  const all = new Set(metrics.records.map(r => r.record_id));
  const conflict = metrics.conflicts.find(c => c.conflict_id === "guatemala-deaths-2026-ew28")!;
  const selected = compactPanelFigures("topic", ["guatemala-measles"], all).flat();
  for (const id of conflict.measure_ids) assert(selected.some(m => m.measure_id === id));
  const without = new Set(all);
  without.delete(measures.get(conflict.measure_ids[0])!.source_reference.record_id);
  assert(!compactPanelFigures("topic", ["guatemala-measles"], without).flat().some(m => conflict.measure_ids.includes(m.measure_id)));
  for (const panel of metrics.panels.filter(p => p.kind === "geographic_link")) {
    const support = new Set(panel.support.map(([id, index]) => `${id}:${index}`));
    for (const m of panelMeasures(panel.kind, [panel.id], all)) {
      assert(m.evidence_references.every(ref => support.has(`${ref.record_id}:${ref.claim_index}`)));
    }
  }
  const zero = metrics.measures.find(m => m.value === 0)!;
  assert.equal(metricValue(zero), "0");
  assert(metrics.series.every(s => s.connect_points === false));
});

test("ATLAS comparisons retain exact participants and require complete evidence", async () => {
  const { bundle, assertions, reportComparisons } = await import("./atlas-fixture");
  const all = new Set(bundle.records.map(r => r.id));
  assert.equal(bundle.comparisons.length, 7);
  for (const comparison of bundle.comparisons) {
    const participants = comparison.participant_ids.map(id => assertions.get(id)!);
    assert(participants.every(Boolean));
    assert(reportComparisons(all, [participants[0].record_id]).some(c => c.id === comparison.id));
    const partial = new Set(all);
    partial.delete(comparison.eligibility.record_ids[0]);
    assert(!reportComparisons(partial, participants.map(a => a.record_id)).some(c => c.id === comparison.id));
  }
  const deaths = reportComparisons(all, ["doc_bf622bc1c2e681cca3bd545c:0"])[0];
  assert.deepEqual(deaths.participant_ids.map(id => measures.get(assertions.get(id)!.measure_id!)!.value), [438, 452]);
  const dates = reportComparisons(all, ["doc_128cebd0edb1e07102849fc4:0:uganda"])[0];
  assert.deepEqual(dates.participant_ids.map(id => assertions.get(id)!.value.value), ["2026-08-25", "2026-08-27"]);
});

test("Repeated DRC totals retain separate WHO and ECDC evidence records", () => {
  const all = new Set(metrics.records.map(r => r.record_id));
  const repeated = panelMeasures("topic", ["drc"], all).filter(m => m.value === 7890);
  assert.equal(repeated.length, 2);
  assert.deepEqual(repeated.map(m => m.source_id).sort(), ["ECDC_CDTR", "WHO_DON"]);
  assert.equal(new Set(repeated.map(m => m.source_reference.document_id)).size, 2);
  const whoOnly = new Set(atlas.records.filter(r => r.source === "WHO_DON").map(r => r.id));
  assert.deepEqual(panelMeasures("topic", ["drc"], whoOnly).filter(m => m.value === 7890).map(m => m.source_id), ["WHO_DON"]);
});


test("Compact DRC cards use ATLAS groups and respect source filters", () => {
  const all = new Set(atlas.records.map(r => r.id));
  const figures = compactPanelFigures("topic", ["drc"], all);
  assert.deepEqual(figures.map(g => g[0].value), [7890, 3799]);
  for (const group of figures) assert.deepEqual(group.map(m => m.source_id).sort(), ["ECDC_CDTR", "WHO_DON"]);
  const whoOnly = new Set(atlas.records.filter(r => r.source === "WHO_DON").map(r => r.id));
  const whoFigures = compactPanelFigures("topic", ["drc"], whoOnly);
  assert.deepEqual(whoFigures.map(g => g[0].value), [7890, 3799]);
  assert(whoFigures.every(g => g.length === 1 && g[0].source_id === "WHO_DON"));
});

test("Reviewed series retain only explicit connections with complete visible support", async () => {
  const { bundle } = await import("./atlas-fixture");
  const { reviewedFixture } = await import("./atlas-reviewed-fixture");
  const { createResearch } = await import("../src/lib/atlas-comparisons");
  const candidate = reviewedFixture(bundle);
  const all = new Set(candidate.records.map(r => r.id));
  const research = createResearch(candidate);
  const selected = research.selectedResearch(all);
  assert.equal(selected.reviewed_series[0].members.length, 4);
  assert.deepEqual(selected.reviewed_series[0].connections.map(e => e.id), ["test-edge"]);
  const hidden = candidate.metrics.reviewed_series[0].members[1].eligibility.record_ids[0];
  const partial = research.selectedResearch(new Set([...all].filter(id => id !== hidden)));
  assert.equal(partial.reviewed_series[0].members.length, 3);
  assert.equal(partial.reviewed_series[0].connections.length, 0);
  assert(!partial.reviewed_series[0].evidence.some(e => e.record_id === hidden));
  assert.equal(partial.numeric_coverage!.reviewed_connection_count, 0);
  assert.equal(partial.numeric_coverage!.records_with_measures + partial.numeric_coverage!.records_without_reviewed_measures, partial.numeric_coverage!.record_count);
  assert.equal(createResearch(bundle).selectedResearch(all).reviewed_series.length, 0);
});


test("Globe compact figures show at most four measurements", () => {
  const all = new Set(atlas.records.map(r => r.id));
  for (const panel of metrics.panels) {
    assert(compactPanelFigures(panel.kind, [panel.id], all).length <= 4);
  }
  const view = createResearch(bundle).selectedResearch(all);
  const panel = view.panels.find(panel => panel.compact_groups.length)!;
  const groups = Array.from({length: 6}, (_, index) => ({...panel.compact_groups[0], id: `test-group-${index}`}));
  const crowded = createMetrics(bundle, () => ({...view, panels: [{...panel, compact_groups: groups}]}));
  assert.equal(crowded.compactPanelFigures(panel.kind, [panel.id], all).length, 4);
});
