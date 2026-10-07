import { test } from "node:test";
import assert from "node:assert/strict";
import { healthPanelsFixture } from "./atlas-health-panels-fixture";
import type { AtlasReportAssessment, AtlasSiteBundle } from "../src/lib/atlas-vendor/browser/0.3/atlas.js";
import { selectView } from "../src/lib/atlas-vendor/browser/0.3/site_view.js";
import { createResearch } from "../src/lib/atlas-comparisons";
import { createIdentities } from "../src/lib/atlas-identities";

test("Report assessments retain their attribution, complete support and review history", () => {
  const base = healthPanelsFixture(), [first, second] = base.records;
  first.publication = "2026-07-02";
  second.publication = "2026-07-04";
  first.capture = second.capture = "2026-07-05T00:00:00Z";
  const assessment: AtlasReportAssessment = {
    id: "synthetic-diagnosis", record_id: first.id, document_id: first.document_id,
    kind: "diagnostic_status", status: "unconfirmed", authority: { value: "Synthetic authority", status: "reported" },
    label: "Cause unconfirmed", scope: "Synthetic illness", reason: "Synthetic evidence for interface tests.",
    source_text_sha256: "a".repeat(64), reviewed_at: "2026-07-06T00:00:00Z", reviewed_by: "Synthetic reviewer",
    review_state: "source_checked_draft", assertion_ids: [], evidence_ids: [], supersedes: [],
    eligibility: { rule: "all_supporting_records_in_window", partial: "hide_relationship_keep_visible_assertions", record_ids: [first.id, second.id] },
  };
  const identity: AtlasReportAssessment = { ...assessment, id: "synthetic-publisher", kind: "source_authenticity", status: "authenticated", label: "Publisher authenticated" };
  const revision: AtlasReportAssessment = { ...assessment, id: "synthetic-revision", status: "disputed", label: "Conflicting diagnostic statements", reviewed_at: "2026-07-08T00:00:00Z", supersedes: [assessment.id] };
  const bundle = { ...base, contract_version: "1.8.0" as const, report_assessments: [identity, assessment, revision] } satisfies AtlasSiteBundle;
  const select = (from: string, until: string, cutoff: string | null = null, ids = [first.id, second.id]) => selectView(bundle, from, until, "publication", cutoff, ids);
  assert.deepEqual(select("2026-07-01", "2026-07-31", "2026-07-05T23:59:59Z").report_assessments, []);
  assert.deepEqual(select("2026-07-01", "2026-07-31", "2026-07-07T00:00:00Z").report_assessments, [identity, assessment]);
  assert.deepEqual(select("2026-07-01", "2026-07-31").report_assessments, [identity, revision]);
  assert.deepEqual(select("2026-07-01", "2026-07-31").superseded_report_assessment_ids, [assessment.id]);
  assert.deepEqual(select("2026-07-03", "2026-07-31").report_assessments, []);
  assert.deepEqual(select("2026-07-01", "2026-07-03").report_assessments, []);
  assert.deepEqual(select("2026-07-01", "2026-07-31", null, [first.id]).report_assessments, []);
  const research = createResearch(bundle);
  assert.deepEqual(research.reportAssessments(new Set([first.id, second.id]), [first.id]), [identity, revision]);
  assert.deepEqual(createResearch(base).reportAssessments(new Set([first.id]), [first.id]), []);
});

test("Publisher identity uses exported names without requiring a logo asset", () => {
  const bundle = healthPanelsFixture();
  bundle.organizations.push({ ...bundle.organizations[0], id: "synthetic-newsroom", name: "Synthetic Newsroom" });
  bundle.channels.push({ ...bundle.channels[0], id: "synthetic-channel", organization_id: "synthetic-newsroom", acquisition_source: "synthetic_source", snapshot_source: "synthetic_source", name: "Synthetic bulletin" });
  const identities = createIdentities(bundle, { transport_version: "0.3.0", source_export_id: "a".repeat(64), tracks: [], records: [], map_links: [], relationships: [] });
  assert.equal(identities.sourceName("synthetic_source"), "Synthetic bulletin");
  assert.equal(identities.reportOrganizations.synthetic_source.name, "Synthetic Newsroom");
  assert.equal(identities.reportOrganizations.synthetic_source.logo, undefined);
});
