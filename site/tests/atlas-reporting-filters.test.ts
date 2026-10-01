import { test } from "node:test";
import assert from "node:assert/strict";
import { atlas } from "./atlas-fixture";
import { healthPanelsFixture } from "./atlas-health-panels-fixture";
import { reportingFacets, type ReportingFilters } from "../src/lib/atlas-reporting-filters";
import type { AtlasDiseaseReview, AtlasLocationMembership } from "../src/lib/atlas-vendor/1.5/site-types";

test("Reporting facets intersect reviewed places and diseases, preserving multiple subjects and unknowns", () => {
  const bundle = healthPanelsFixture();
  const rows = atlas.records.slice(0, 6).map((row, index) => ({ ...row, id: String(index), track: "topic", source: index === 2 ? "B" : "A" }));
  const eligibility = (ids: string[]) => ({ rule: "all_supporting_records_in_window" as const, record_ids: ids, partial: "hide_relationship_keep_visible_assertions" as const });
  const membership = (record: number, code: string, role: AtlasLocationMembership["role"] = "occurrence", support = [String(record)]): AtlasLocationMembership => ({
    id: `${record}:${code}:${role}`, record_id: String(record), document_id: rows[record].document_id, claim_index: null,
    area_code: code, role, evidence_ids: [], reason: "Synthetic test location", review_state: "source_checked_draft", eligibility: eligibility(support),
  });
  const review = (record: number, kind: AtlasDiseaseReview["kind"], diseases: string[], support = [String(record)]): AtlasDiseaseReview => ({
    id: String(record), record_id: String(record), kind, disease_ids: diseases, reason: "Synthetic test review",
    reviewed_at: "2026-10-01", reviewed_by: "Test", review_status: "source_checked_draft", evidence_ids: [], eligibility: eligibility(support),
  });
  bundle.areas = [{ code: "NG", label: "Nigeria", code_system: "ISO_3166_1_alpha_2", meaning: "country" }, { code: "UG", label: "Uganda", code_system: "ISO_3166_1_alpha_2", meaning: "country" }];
  bundle.diseases = [{ id: "lassa", label: "Lassa fever" }, { id: "cholera", label: "Cholera" }];
  bundle.location_memberships = [membership(0, "NG"), membership(0, "NG", "reporting_scope"), membership(1, "NG"), membership(2, "UG"), membership(3, "NG", "context"), membership(4, "NG", "occurrence", ["4", "outside-window"])];
  bundle.disease_reviews = [review(0, "single_disease", ["lassa"]), review(1, "multiple_diseases", ["lassa", "cholera"]), review(2, "single_disease", ["cholera"]), review(3, "not_disease_specific", []), review(4, "single_disease", ["lassa"], ["4", "outside-window"]), review(5, "unresolved", [])];
  const empty: ReportingFilters = { places: [], diseases: [], topics: [], sources: [], includeContext: false };
  const select = (filters: Partial<ReportingFilters> = {}) => reportingFacets(bundle, rows, { ...empty, ...filters });
  const ids = (filters: Partial<ReportingFilters>) => select(filters).rows.map(row => row.id);
  assert.deepEqual(ids({ places: ["NG"], diseases: ["lassa"] }), ["0", "1"]);
  assert.deepEqual(ids({ places: ["NG", "UG"], diseases: ["cholera"] }), ["1", "2"]);
  assert.deepEqual(ids({ diseases: ["lassa", "cholera"] }), ["0", "1", "2"]);
  assert.deepEqual(ids({ diseases: ["unclassified"] }), ["4", "5"]);
  assert.deepEqual(ids({ places: ["unspecified"] }), ["3", "4", "5"]);
  assert.deepEqual(ids({ places: ["NG"], includeContext: true }), ["0", "1", "3"]);
  assert.deepEqual(ids({ places: ["NG"], diseases: ["not_disease_specific"] }), []);
  assert.deepEqual(ids({ places: ["NG"], diseases: ["not_disease_specific"], includeContext: true }), ["3"]);
  assert.deepEqual(ids({ diseases: ["cholera"], sources: ["A"] }), ["1"]);
  assert.deepEqual(ids({ topics: ["missing"] }), []);
  const intersection = select({ places: ["NG"], diseases: ["cholera"] });
  assert.equal(intersection.places.find(item => item.value === "UG")!.count, 1);
  assert.equal(intersection.places.find(item => item.value === "NG")!.count, 1);
  assert.equal(intersection.diseases.find(item => item.value === "lassa")!.count, 2);
  assert.equal(select().places.find(item => item.value === "NG")!.count, 2);
  assert.equal(select({ sources: ["A"] }).diseases.find(item => item.value === "cholera")!.count, 1);
  assert.equal(reportingFacets(bundle, [], empty).rows.length, 0);
});
