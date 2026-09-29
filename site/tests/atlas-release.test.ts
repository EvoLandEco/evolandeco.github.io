import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { weeklyCycle, publicationCandidate, correctionSchema, checkCorrectionTarget } from "../scripts/sync-atlas";
import { verifiedBytes, releaseSchema, fetchAtlasData } from "../src/lib/atlas-release";
import fixture from "./atlas-fixture.json";
import type { AtlasPublicationHandoff } from "../src/lib/atlas-vendor/site-types";

test("Publication requires all three matching weekly receipts", () => {
  assert.equal(weeklyCycle(new Date("2026-09-26T18:00:00Z")), "2026-09-23");
  assert.equal(weeklyCycle(new Date("2026-09-29T22:05:00Z")), "2026-09-30");
  const candidate = { export_id: "a".repeat(64), counts_as_weekly_completion: false };
  const handoff = { handoff_version: "1.0.0", cycle: "2026-09-23", timezone: "Europe/Amsterdam", weekly_ready: false,
    execution_status: "not_ready", jobs: {}, ledger: { integrity: "ok" }, blocking_reasons: ["review:missing"], unapplied_decision_ids: [],
    current_export: null, initial_candidate: candidate } as unknown as AtlasPublicationHandoff;
  assert.equal(publicationCandidate(handoff, handoff.cycle, false), null);
  assert.equal(publicationCandidate(handoff, handoff.cycle, true), candidate);
  assert.throws(() => publicationCandidate(handoff, "2026-09-30", true));
  handoff.weekly_ready = true; handoff.execution_status = "completed"; handoff.blocking_reasons = [];
  assert.throws(() => publicationCandidate(handoff, handoff.cycle, false));
  for (const job of ["review", "production", "inbox"] as const) handoff.jobs[job] = { status: "completed", completed_at: "2026-09-23T12:00:00Z", receipt: { path: job, sha256: "a".repeat(64), bytes: 1 } };
  handoff.current_export = candidate as unknown as NonNullable<typeof handoff.current_export>;
  assert.equal(publicationCandidate(handoff, handoff.cycle, false), candidate);
  handoff.jobs.inbox.status = "partial";
  assert.throws(() => publicationCandidate(handoff, handoff.cycle, false));
});
test("Remote release bytes must match their published checksums", async () => {
  const bytes = Buffer.from('{"records":[]}');
  const expected = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  assert.equal((await verifiedBytes(new Response(bytes), expected)).byteLength, bytes.length);
  await assert.rejects(verifiedBytes(new Response("wrong"), expected), /checksum/);
  await assert.rejects(verifiedBytes(new Response(null, { status: 503 }), expected), /503/);
});

test("Corrections require authorization for the exact published release", () => {
  const existing = releaseSchema.parse(fixture.release);
  const authorization = { correction_version: "1.0.0", replaces_export_id: existing.export_id, reason: "Geographic review",
    authorization: { thread_id: "website", instruction: "Adopt the reviewed geographic export." },
    export: { bundle_path: "/export/structured", map_snapshot_path: "/export/map.json" } };
  assert(correctionSchema.safeParse(authorization).success);
  assert(!correctionSchema.safeParse({ ...authorization, authorization: {} }).success);
  assert(!correctionSchema.safeParse({ ...authorization, replaces_export_id: "" }).success);
  checkCorrectionTarget(authorization.replaces_export_id, existing);
  assert.throws(() => checkCorrectionTarget("f".repeat(64), existing), /does not match/);
  assert.throws(() => checkCorrectionTarget(existing.export_id, null), /existing publication/);
  const corrected = releaseSchema.parse({ ...existing, correction: { replaces_export_id: existing.export_id, authorization_sha256: "a".repeat(64) } });
  assert.deepEqual(corrected.correction, { replaces_export_id: existing.export_id, authorization_sha256: "a".repeat(64) });
});


test("Loading checks the bundle identity and honors cancellation between data tasks", async t => {
  const map = Buffer.from('{}');
  const digest = (bytes: Buffer) => ({ sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length });
  let bundle = Buffer.from(JSON.stringify({ contract_version: fixture.release.contract_version, snapshot: { source_snapshot_sha256: digest(map).sha256 } }));
  t.mock.method(globalThis, 'fetch', async (url: string) => url.endsWith('/current.json')
    ? Response.json({ ...fixture.release, assets: { ...fixture.release.assets, 'map.json': digest(map), 'atlas-site.json': digest(bundle) } })
    : new Response(url.endsWith('/map.json') ? map : bundle));
  assert.equal((await fetchAtlasData()).bundle.contract_version, fixture.release.contract_version);
  await assert.rejects(fetchAtlasData(AbortSignal.abort()), { name: 'AbortError' });
  bundle = Buffer.from(JSON.stringify({ contract_version: '1.5.0', snapshot: { source_snapshot_sha256: digest(map).sha256 } }));
  await assert.rejects(fetchAtlasData(), /does not match/);
});
