import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { z } from "zod";
import hosting from "../src/content-data/atlas-hosting.json";
import { releaseSchema, verifiedBytes, releaseRoot, type AtlasRelease } from "../src/lib/atlas-release";
import type { AtlasPublicationHandoff, AtlasFileReference, AtlasExportReference } from "../src/lib/atlas-vendor/site-types";
import { validateAtlas } from "./validate-atlas-metrics";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const correctionSchema = z.object({
  correction_version: z.literal("1.0.0"), replaces_export_id: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().min(1), authorization: z.object({ thread_id: z.string().min(1), instruction: z.string().min(1) }),
  export: z.object({ bundle_path: z.string().min(1), map_snapshot_path: z.string().min(1) }).passthrough(),
});
export function checkCorrectionTarget(replaces: string, existing: AtlasRelease | null) {
  assert(existing, "A correction requires an existing publication");
  assert.equal(existing.export_id, replaces, "Correction authorization does not match the published release");
}
export function weeklyCycle(today = new Date()) {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" }).format(today);
  const date = new Date(local + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 4) % 7);
  return date.toISOString().slice(0, 10);
}
export function publicationCandidate(handoff: AtlasPublicationHandoff, cycle: string, initial: boolean) {
  assert.equal(handoff.handoff_version, "1.0.0");
  assert.equal(handoff.cycle, cycle);
  assert.equal(handoff.timezone, "Europe/Amsterdam");
  if (initial) {
    assert(handoff.initial_candidate && !handoff.initial_candidate.counts_as_weekly_completion);
    return handoff.initial_candidate;
  }
  if (!handoff.weekly_ready) return null;
  assert.equal(handoff.execution_status, "completed");
  assert.equal(handoff.ledger.integrity, "ok");
  assert.equal(handoff.blocking_reasons.length, 0);
  assert.equal(handoff.unapplied_decision_ids.length, 0);
  for (const job of ["review", "production", "inbox"] as const) {
    assert.equal(handoff.jobs[job].status, "completed");
    assert(handoff.jobs[job].receipt && handoff.jobs[job].completed_at);
  }
  assert(handoff.current_export);
  return handoff.current_export;
}
async function checkedFile(ref: AtlasFileReference) {
  const bytes = await readFile(ref.path);
  assert.equal(bytes.length, ref.bytes, ref.path);
  assert.equal(hash(bytes), ref.sha256, ref.path);
  return bytes;
}
async function currentRelease() {
  const response = await fetch(`${hosting.origin}/current.json`, { cache: "no-cache" });
  if (response.status === 404) return null;
  assert(response.ok, `Cannot read published release: ${response.status}`);
  return releaseSchema.parse(await response.json());
}
export async function syncAtlas(project: string, cycle: string, initial = false, correctionPath?: string, stageOnly = false) {
  assert(!(initial && correctionPath), "Choose either initial publication or correction");
  const cache = resolve(site, ".cache/atlas-sync");
  await mkdir(cache, { recursive: true });
  const lock = resolve(cache, "lock");
  await mkdir(lock);
  try {
    const handoffPath = resolve(cache, "handoff.json");
    const correction = async () => {
      const bytes = await readFile(correctionPath!);
      const authorization = correctionSchema.parse(JSON.parse(bytes.toString()));
      const candidate = JSON.parse(execFileSync(resolve(project, ".venv/bin/python"), ["-c",
        "import json,sys; from pathlib import Path; from atlas.handoff import inspect_export; print(json.dumps(inspect_export(Path(sys.argv[1]), Path(sys.argv[2]))))",
        authorization.export.bundle_path, authorization.export.map_snapshot_path], { cwd: project, encoding: "utf8", env: { ...process.env, PYTHONPATH: resolve(project, "src") } })) as AtlasExportReference;
      assert.deepEqual(candidate, authorization.export, "Correction export differs from its authorization");
      return { ...authorization, export: candidate, authorization_sha256: hash(bytes) };
    };
    const handoff = async () => {
      execFileSync(resolve(project, ".venv/bin/atlas"), ["--state", ".runtime-state", "handoff", "--cycle", cycle, "--out", handoffPath,
        ...(initial ? ["--initial-bundle", "reports/six-month/compact-figures-v1/structured", "--initial-snapshot", ".local/six-month/export-inputs/snapshot.json"] : [])], { cwd: project, stdio: "inherit" });
      return JSON.parse(await readFile(handoffPath, "utf8")) as AtlasPublicationHandoff;
    };
    const first = correctionPath ? await correction() : await handoff();
    const candidate = "export" in first ? first.export : publicationCandidate(first, cycle, initial);
    if (!candidate) { console.log(JSON.stringify({ status: "not_ready", cycle, reasons: "blocking_reasons" in first ? first.blocking_reasons : [] })); return; }
    assert.equal(candidate.contract_version, hosting.contract_version);
    assert.equal(candidate.selector.sha256, hosting.selector_sha256, "ATLAS selector requires a compatibility review");
    assert.equal(candidate.integrity.status, "valid");
    assert(/^[a-f0-9]{64}$/.test(candidate.export_id));
    for (const ref of [candidate.manifest, candidate.selector, ...Object.values(candidate.files)]) await checkedFile(ref);
    const bundleBytes = await checkedFile(candidate.structured_data);
    const mapBytes = await checkedFile(candidate.map_snapshot);
    const { bundle } = validateAtlas(candidate.bundle_path, candidate.map_snapshot_path);
    const existing = await currentRelease();
    if (existing?.export_id === candidate.export_id) { console.log(JSON.stringify({ status: "unchanged", export_id: existing.export_id })); return; }
    if ("export" in first) checkCorrectionTarget(first.replaces_export_id, existing);
    assert(!initial || !existing, "Initial publication cannot replace an existing release");
    assert(!existing?.cycle || existing.cycle <= cycle, "Cannot publish an older weekly cycle");
    const assets = { "atlas-site.json": bundleBytes, "map.json": mapBytes, "metrics.json": Buffer.from(JSON.stringify(bundle.metrics)) };
    const release: AtlasRelease = releaseSchema.parse({ version: 1, export_id: candidate.export_id, published_at: new Date().toISOString(),
      cycle: correctionPath ? existing!.cycle : initial ? null : cycle, mode: correctionPath ? existing!.mode : initial ? "initial" : "weekly", contract_version: candidate.contract_version,
      ...("export" in first ? { correction: { replaces_export_id: first.replaces_export_id, authorization_sha256: first.authorization_sha256 } } : {}),
      selector_sha256: candidate.selector.sha256, assets: Object.fromEntries(Object.entries(assets).map(([name, bytes]) => [name, { sha256: hash(bytes), bytes: bytes.length }])) });
    const put = (key: string, path: string, compressed: boolean) => execFileSync(process.execPath, [resolve(site, "node_modules/wrangler/bin/wrangler.js"), "r2", "object", "put", `${hosting.bucket}/${key}`, "--file", path, "--remote", "--content-type", "application/json", ...(compressed ? ["--content-encoding", "gzip"] : [])], { cwd: site, stdio: "inherit" });
    for (const [name, bytes] of Object.entries(assets)) {
      const path = resolve(cache, name + ".gz");
      await writeFile(path, gzipSync(bytes, { level: 9 }));
      put(`releases/${release.export_id}/${name}.gz`, path, true);
      await verifiedBytes(await fetch(`${releaseRoot(release)}/${name}`, { cache: "no-cache" }), release.assets[name as keyof typeof assets]);
    }
    const final = correctionPath ? await correction() : await handoff();
    if ("export" in final) assert.deepEqual(final, first, "Correction authorization changed during upload");
    else {
      assert(!("export" in first));
      assert.equal(publicationCandidate(final, cycle, initial)?.export_id, candidate.export_id, "Export changed during upload");
      assert.deepEqual(final.ledger, first.ledger, "Ledger changed during upload");
      assert.deepEqual(final.jobs, first.jobs, "Weekly receipts changed during upload");
    }
    assert.deepEqual(await currentRelease(), existing, "Published release changed during upload");
    const releasePath = resolve(cache, "current.json");
    await writeFile(releasePath, JSON.stringify(release));
    if (stageOnly) {
      await writeFile(resolve(cache, `staged-${release.export_id}.json`), JSON.stringify({ release, handoff: final }, null, 2));
      console.log(JSON.stringify({ status: "staged", export_id: release.export_id, url: releaseRoot(release), activation_pending: true }));
      return;
    }
    put("current.json", releasePath, false);
    assert.deepEqual(await currentRelease(), release);
    await writeFile(resolve(cache, `${correctionPath ? `correction-${release.export_id}` : initial ? "initial" : cycle}.json`), JSON.stringify({ release, handoff: final }, null, 2));
    console.log(JSON.stringify({ status: "published", mode: correctionPath ? "correction" : release.mode, cycle: release.cycle, export_id: release.export_id, url: hosting.origin }));
  } finally { await rm(lock, { recursive: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { project: { type: "string" }, cycle: { type: "string" }, initial: { type: "boolean", default: false }, correction: { type: "string" }, "stage-only": { type: "boolean", default: false } } });
  assert(values.project, "Supply --project with the local ATLAS checkout");
  syncAtlas(resolve(values.project), values.cycle ?? weeklyCycle(), values.initial, values.correction, values["stage-only"]).catch(error => { console.error(error); process.exitCode = 1; });
}
