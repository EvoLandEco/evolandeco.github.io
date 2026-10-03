import type { AtlasData } from "./atlas-contract";
import type { createResearch } from "./atlas-comparisons";
export type Measure = AtlasData["metrics"]["measures"][number];
export function measureRecord(measure: Measure) {
  return "source_record_id" in measure ? measure.source_record_id : measure.source_reference.record_id;
}
export function measureEvidenceRecords(measure: Measure) {
  return "evidence_record_ids" in measure ? measure.evidence_record_ids : measure.evidence_references.map(ref => ref.record_id);
}
export function visibleMeasure(measure: Measure, recordIds: Set<string>) {
  return measureEvidenceRecords(measure).every(id => recordIds.has(id));
}
const metricFormatter = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
export function metricValue(measure: Pick<Measure, "value" | "value_status" | "unit">) {
  if (measure.value === null) return measure.value_status.replaceAll("_", " ");
  return metricFormatter.format(measure.value) + (measure.unit === "percent" ? "%" : "");
}
export function createMetrics<B extends AtlasData>(bundle: B, selectedResearch: ReturnType<typeof createResearch>["selectedResearch"]) {
  const metrics: B["metrics"] = bundle.metrics;
  const measures = new Map<string, B["metrics"]["measures"][number]>(metrics.measures.map(m => [m.measure_id, m]));

  function panelMeasures(kind: string, ids: string[], recordIds: Set<string>) {
    const panels = selectedResearch(recordIds).panels.filter(p => p.kind === kind && ids.includes(p.id));
    const selected = panels.flatMap(p => p.measure_ids);
    return [...new Set(selected)].map(id => measures.get(id)!).filter(m => visibleMeasure(m, recordIds));
  }

  function compactPanelFigures(kind: string, ids: string[], recordIds: Set<string>) {
    const figures = selectedResearch(recordIds).panels.filter(p => p.kind === kind && ids.includes(p.id)).flatMap(p => p.compact_groups);
    const unique = [...new Map(figures.map(g => [g.id, g])).values()];
    const contexts = new Set(unique.slice(0, 2).flatMap(g => g.context_ids));
    return unique.filter(g => g.context_ids.some(id => contexts.has(id))).slice(0, 4)
      .map(g => g.measure_ids.map(id => measures.get(id)!));
  }

  return { metrics, measures, panelMeasures, compactPanelFigures };
}
