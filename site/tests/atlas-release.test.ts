import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { weeklyCycle, publicationCandidate, correctionSchema, checkCorrectionTarget, requireSyncAttachments } from "../scripts/sync-atlas";
import { verifiedBytes, parseAtlasJson, releaseSchema, fetchAtlasData, type AtlasLoadProgress } from "../src/lib/atlas-release";
import fixture from "./atlas-fixture.json";
import presentationFixture from "./atlas-presentation-fixture.json";
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
test("Scientific staging can precede attachment delivery while activation retains attachments", () => {
  const current = releaseSchema.parse(presentationFixture.release);
  const exportId = "f".repeat(64);
  const candidate = { ...current, export_id: exportId, source_text: undefined, watch: undefined,
    source_supplement: { ...current.source_supplement!, source_export_id: exportId } };
  requireSyncAttachments(current, candidate, true);
  assert.throws(() => requireSyncAttachments(current, candidate, false), /must retain source_text/);
  const complete = { ...candidate, source_text: { ...current.source_text!, source_export_id: exportId },
    watch: { ...current.watch!, source_export_id: exportId } };
  requireSyncAttachments(current, complete, false);
  assert.throws(() => requireSyncAttachments(current, { ...complete, watch: undefined }, false), /must retain watch/);
  const base = { ...candidate, source_supplement: undefined };
  requireSyncAttachments(current, base, true);
  assert.throws(() => requireSyncAttachments(current, base, false), /must include a supplement/);
  assert.throws(() => requireSyncAttachments(current, { ...current, source_supplement: { ...current.source_supplement!, sha256: "e".repeat(64) } }, false), /must preserve/);
  assert.throws(() => requireSyncAttachments(current, { ...current, watch: { ...current.watch!, sha256: "e".repeat(64) } }, false), /Same export must retain watch/);
});
test("Remote release bytes must match their published checksums", async () => {
  const bytes = Buffer.from('{"records":[]}');
  const expected = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  assert.equal((await verifiedBytes(new Response(bytes), expected)).byteLength, bytes.length);
  await assert.rejects(verifiedBytes(new Response("wrong"), expected), /checksum/);
  await assert.rejects(verifiedBytes(new Response(null, { status: 503 }), expected), /503/);
});

test("Chunked dataset parsing preserves text and nested values across boundaries and can be cancelled", async () => {
  const encode = (text: string) => new TextEncoder().encode(text).buffer;
  const chunkSize = 1024 * 1024;
  for (let split = 0; split < 8; split++) {
    const text = JSON.stringify({ text: "x".repeat(chunkSize - 10 - split) + 'é🧬\\"{}[]',
      records: [{ values: [null, true, false, -1.25e12], text: "\n\t" }], empty: {} });
    assert.deepEqual(await parseAtlasJson(encode(text)), JSON.parse(text));
    await assert.rejects(parseAtlasJson(encode(text.slice(0, -1))));
  }
  for (const text of ['{"__proto__":{"value":1},"constructor":2}', '[0,-0,1e3,null,false,"\\ud800"]']) {
    assert.deepEqual(await parseAtlasJson(encode(text)), JSON.parse(text));
  }
  for (const text of ['', '{}{}', '{"value":}', '[1,]', '{"value":1,}']) {
    await assert.rejects(parseAtlasJson(encode(text)));
  }
  const controller = new AbortController();
  const parsing = parseAtlasJson(encode(JSON.stringify({ records: Array(100_000).fill({ value: 1 }) })), controller.signal);
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(parsing, { name: "AbortError" });
});

test("Download progress counts decoded stream bytes and preserves checksum validation", async () => {
  const bytes = new TextEncoder().encode('{"records":[]}');
  const expected = { bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  const progress: number[] = [];
  let finish!: () => void;
  const body = new ReadableStream<Uint8Array>({ start(controller) {
    controller.enqueue(bytes.slice(0, 4));
    finish = () => { controller.enqueue(bytes.slice(4)); controller.close(); };
  } });
  const download = verifiedBytes(new Response(body, { headers: { 'Content-Length': '7', 'Content-Encoding': 'gzip' } }), expected, loaded => {
    progress.push(loaded);
    if (loaded === 4) finish();
  });
  assert.deepEqual(new Uint8Array(await download), bytes);
  assert.deepEqual(progress, [4, bytes.length]);
  await assert.rejects(verifiedBytes(new Response(bytes.slice(0, -1)), expected, () => {}), /checksum/);
  await assert.rejects(verifiedBytes(new Response(new Uint8Array(bytes.length)), expected, () => {}), /checksum/);
  for (const report of [undefined, () => {}]) {
    let cancelled = false;
    const oversized = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(bytes.length + 1)); }, cancel() { cancelled = true; } });
    await assert.rejects(verifiedBytes(new Response(oversized), expected, report), /checksum/);
    assert(cancelled);
  }
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
  const { browserFixture } = await import('./atlas-browser-fixture.mjs');
  const { bundle } = await import('./atlas-fixture');
  const { readFileSync } = await import('node:fs');
  const { release, bodies } = browserFixture(bundle, JSON.parse(readFileSync('.cache/atlas-fixture/map.json', 'utf8')));
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(bodies[new URL(url).pathname]));
  const progress: AtlasLoadProgress[] = [];
  assert.equal((await fetchAtlasData(undefined, value => progress.push(value))).bundle.contract_version, '1.8.0');
  assert.equal(progress[0].phase, 'release');
  assert.equal(progress.at(-1)!.phase, 'prepare');
  assert(progress.some(p => p.phase === 'verify'));
  const total = progress.at(-1)!.total;
  assert(progress.slice(1).every(p => p.total === total && p.loaded <= total));
  assert(progress.every((p, i) => !i || p.loaded >= progress[i - 1].loaded));
  assert.equal(progress.at(-1)!.loaded, total);
  await assert.rejects(fetchAtlasData(AbortSignal.abort()), { name: 'AbortError' });
  const controller = new AbortController();
  const cancelled: AtlasLoadProgress[] = [];
  await assert.rejects(fetchAtlasData(controller.signal, value => {
    cancelled.push(value);
    if (value.phase === 'download') controller.abort();
  }), { name: 'AbortError' });
  assert(!cancelled.some(value => value.phase === 'prepare'));
  release.assets['map.json'].sha256 = '0'.repeat(64);
  bodies['/current.json'] = Buffer.from(JSON.stringify(release));
  await assert.rejects(fetchAtlasData(), /source mismatch/);
});
