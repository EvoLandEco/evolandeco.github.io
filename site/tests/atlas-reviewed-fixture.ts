import { readFileSync } from "node:fs";
import type { AtlasSiteBundle, AtlasReviewedSeries, AtlasEligibility } from "../src/lib/atlas-vendor/1.1/site-types";
import type { AtlasSiteBundle as Version10 } from "../src/lib/atlas-vendor/site-types";

export function reviewedFixture(base: Version10): AtlasSiteBundle {
  if (process.env.ATLAS_REVIEWED_CANDIDATE) return JSON.parse(readFileSync(process.env.ATLAS_REVIEWED_CANDIDATE, "utf8"));
  const measures = base.metrics.measures.filter(m => m.disease.value === "Lassa fever" && m.label === "Confirmed cases" && m.count_kind === "interval").sort((a, b) => a.observation_date!.localeCompare(b.observation_date!));
  const support = (record_ids: string[]): AtlasEligibility => ({ rule: "all_supporting_records_in_window", record_ids, partial: "hide_relationship_keep_visible_assertions" });
  const evidence = measures.map((m, i) => ({ ...base.evidence.find(e => e.record_id === m.source_reference.record_id)!, key: `fixture-${i}` }));
  const members = measures.map((m, i) => ({ measure_id: m.measure_id, evidence_ids: [evidence[i].id], eligibility: support([m.source_reference.record_id]) }));
  const series: AtlasReviewedSeries = {
    series_id: "test-reviewed-series", label: "Test reporting series", operation: "reported_interval_counts", scope: "Test fixture · weekly confirmed Lassa cases · Nigeria",
    reason: "Contract rendering test", limitations: ["Test review metadata"], reviewed_by: "Test fixture", reviewed_at: "2026-09-27T00:00:00Z",
    review_status: "source_checked_draft", comparability_status: "reviewed_for_reported_counts", evidence, members,
    connections: [{ id: "test-edge", from_measure_id: members[0].measure_id, to_measure_id: members[1].measure_id,
      evidence_ids: [...members[0].evidence_ids, ...members[1].evidence_ids], eligibility: support([...members[0].eligibility.record_ids, ...members[1].eligibility.record_ids]) }],
  };
  return { ...base, contract_version: "1.1.0", metrics: { ...base.metrics, contract_version: "0.2.0", reviewed_series: [series] } };
}
