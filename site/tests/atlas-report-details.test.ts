import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { groupReportClaims, groupReportMeasures, internalVersionComparison, groupVersionReviews, groupDailyFindings } from "../src/lib/atlas-report-details";
import { dailyFixture } from "./atlas-daily-fixture";
import { releaseSchema } from "../src/lib/atlas-release";
import releaseFixture from "./atlas-fixture.json";
import { bundle } from "./atlas-fixture";
import type { AtlasMapSnapshot } from "../src/lib/atlas-contract";

const snapshot: AtlasMapSnapshot = JSON.parse(readFileSync(".cache/atlas-fixture/map.json", "utf8"));

test("Grouped report findings keep every exact source reference and changed statement", () => {
  const original = snapshot.records.find(record => record.claims.length && record.claims.every(claim => claim.quotes.length))!;
  const copies = [original, ...["copy", "alias"].map(id => ({ ...structuredClone(original), id, document_id: id }))];
  const claims = groupReportClaims(copies);
  assert.equal(claims.length, original.claims.length);
  assert.equal(claims[0].length, 3);
  assert.deepEqual(claims[0].map(ref => ref.record.id), copies.map(record => record.id));
  assert.equal(groupReportClaims([original, original]).length, original.claims.length * 2);
  copies[2].claims[0].text += " A separate finding.";
  assert.equal(groupReportClaims(copies).length, original.claims.length + 1);
  copies[2].claims[0] = { ...original.claims[0], quotes: ["A different reporting period."] };
  assert.equal(groupReportClaims(copies).length, original.claims.length + 1);
  assert.deepEqual(groupReportClaims([copies[1]])[0].map(ref => ref.record.id), ["copy"]);
});

test("Source version figures combine exact scope and preserve conflicting or changed values", () => {
  const original = bundle.metrics.measures.find(m => !m.conflict_set && !m.superseded && !m.supersedes.length && !m.proposal_candidates.length)!;
  const copy = { ...structuredClone(original), measure_id: "copy", context_id: "copy", track_id: "copy", capture: "2026-10-14T08:00:00Z", source_url: "https://example.org/alias", source_reference: { ...original.source_reference, document_id: "copy", record_id: "copy" } };
  assert.equal(groupReportMeasures([original, copy]).length, 1);
  assert.equal(groupReportMeasures([original, copy])[0].length, 2);
  for (const changes of [{ value: 999999 }, { population: { value: "Another population", status: "reported" as const } }, { observation_date: "2000-01-01" }, { qualifier: original.qualifier === "at_least" ? "approximately" : "at_least" }, { conflict_set: "conflict" }, { supersedes: ["prior"] }]) {
    assert.equal(groupReportMeasures([original, { ...copy, ...changes }]).length, 2);
  }
});

test("Publication version comparisons stay separate from cross-report and unresolved comparisons", () => {
  const comparison = bundle.comparisons.find(c => c.kind === "republication")!;
  const assertions = new Map(bundle.assertions.map(a => [a.id, a]));
  const records = new Set(comparison.participant_ids.map(id => assertions.get(id)!.record_id));
  assert.equal(internalVersionComparison(comparison, records, assertions), true);
  assert.equal(internalVersionComparison({ ...comparison, status: "unresolved" }, records, assertions), false);
  assert.equal(internalVersionComparison({ ...comparison, kind: "contradiction" }, records, assertions), false);
  assert.equal(internalVersionComparison(comparison, new Set([...records].slice(1)), assertions), false);
  const copy = { ...comparison, id: "copy", participant_ids: ["another", "pair"] };
  assert.equal(groupVersionReviews([comparison, copy]).length, 1);
  assert.equal(groupVersionReviews([comparison, { ...copy, scope_review: "Another scope" }]).length, 2);
});

test("Daily versions combine matching findings without losing status or source evidence", () => {
  const data = dailyFixture(releaseSchema.parse(releaseFixture.release));
  const original = data.findings[0], evidence = data.evidence[0];
  const copy = { ...original, id: "copy", document_id: "copy", evidence_ids: ["copy"] };
  const proofs = [evidence, { ...evidence, id: "copy", document_id: "copy" }];
  assert.equal(groupDailyFindings([original, copy], proofs).length, 1);
  assert.equal(groupDailyFindings([original, { ...copy, status: "source_confirmed" }], proofs).length, 2);
  assert.equal(groupDailyFindings([original, copy], [evidence, { ...proofs[1], quote: "Different source statement." }]).length, 2);
});
