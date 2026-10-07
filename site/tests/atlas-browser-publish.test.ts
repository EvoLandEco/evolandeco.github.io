import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { browserPublicationSchema, attachBrowserDescriptor, checkBrowserHandoff, stageBrowserAsset, requireCurrentBrowserDescriptor } from "../scripts/publish-atlas-browser";
import type { AtlasBrowserManifest } from "../src/lib/atlas-browser";
import type { AtlasRelease } from "../src/lib/atlas-release";
import fixture from "./atlas-fixture.json";
import hosting from "../src/content-data/atlas-hosting.json";

test("Browser attachment preserves every release field and rejects silent replacement", () => {
  const base = { ...fixture.release, extra_analysis: { identity: "preserve" }, assets: { ...fixture.release.assets, "future.json": { bytes: 8, sha256: "e".repeat(64) } } };
  const descriptor = { sha256: "f".repeat(64), bytes: 100 };
  const attached = attachBrowserDescriptor(base, descriptor);
  assert.deepEqual(attached, { ...base, browser: { transport_version: "0.3.0", manifest: descriptor } });
  assert.deepEqual(attachBrowserDescriptor(attached, descriptor), attached);
  assert.throws(() => attachBrowserDescriptor(attached, { ...descriptor, sha256: "a".repeat(64) }), /separate review/);
  assert.equal(attachBrowserDescriptor(base, descriptor, "0.3.0").browser.transport_version, "0.3.0");

});

test("Browser publication authorization binds destination, source and explicit approval state", () => {
  const ref = { path: "/synthetic/file.json", bytes: 100, sha256: "a".repeat(64) };
  const input = { format: "atlas-browser-publication/1", destination: hosting.origin, bucket: hosting.bucket,
    approval_status: "pending", authorization: { thread_id: "test", instruction: "Stage this specific synthetic fixture" },
    release: ref, handoff: ref,
    source: { manifest: ref, site: ref, map: ref, selector: ref }, browser: { manifest: ref } };
  assert.equal(browserPublicationSchema.parse(input).approval_status, "pending");
  assert.throws(() => browserPublicationSchema.parse({ ...input, destination: "https://elsewhere.invalid" }));
  assert.throws(() => browserPublicationSchema.parse({ ...input, approval_status: "assumed" }));
  assert.throws(() => browserPublicationSchema.parse({ ...input, browser: { manifest: { ...ref, sha256: "bad" } } }));
  assert.throws(() => browserPublicationSchema.parse({ ...input, bypass: true }));
});

test("Same-export publication rejects a stale receipt that loses or changes browser transport", () => {
  const base = fixture.release as AtlasRelease;
  const current: AtlasRelease = { ...base, browser: { transport_version: "0.1.0", manifest: { sha256: "b".repeat(64), bytes: 100 } } };
  assert.throws(() => requireCurrentBrowserDescriptor(current, base), /must preserve/);
  assert.throws(() => requireCurrentBrowserDescriptor(current, { ...current, browser: { ...current.browser!, manifest: { ...current.browser!.manifest, bytes: 101 } } }), /must preserve/);
  requireCurrentBrowserDescriptor(current, structuredClone(current));
  requireCurrentBrowserDescriptor(base, current);
  requireCurrentBrowserDescriptor(current, { ...base, export_id: "c".repeat(64) });
});

test("Stable producer handoffs require exact source bindings, reconstruction and every-record parity", async () => {
  const handoff = JSON.parse(await readFile(new URL("../evidence/browser-transport-stable-handoff-2026-10-02.json", import.meta.url), "utf8"));
  handoff.browser.transport_version = "0.3.0";
  handoff.browser.directory = join(tmpdir(), "atlas-browser-handoff");
  handoff.browser.manifest.path = join(handoff.browser.directory, "manifest.json");
  const assets = Object.fromEntries(Array.from({ length: handoff.asset_count }, (_, i) => [`details/synthetic-${i}.json`, { bytes: 1, sha256: "a".repeat(64), kind: "detail" }]));
  const manifest = { transport_version: handoff.browser.transport_version, source_export_id: handoff.source_export_id, source: handoff.browser.source, assets } as AtlasBrowserManifest;
  const check = (candidate = handoff, ref = handoff.browser.manifest) => checkBrowserHandoff(candidate, manifest, ref);
  assert.equal(check().selection_cases, 2220);
  assert.throws(() => check({ ...handoff, browser: { ...handoff.browser, transport_version: "0.2.0" } }));
  const version02 = { ...handoff, browser: { ...handoff.browser, transport_version: "0.3.0" } };
  assert.equal(checkBrowserHandoff(version02, { ...manifest, transport_version: "0.3.0" }, handoff.browser.manifest).browser.transport_version, "0.3.0");
  for (const field of ["reconstruction", "all_records_individually", "producer_ready", "pinned_selector_parity"]) assert.throws(() => check({ ...handoff, [field]: false }));
  assert.throws(() => check({ ...handoff, source_files_compared: ["site"] }));
  assert.throws(() => check(handoff, { ...handoff.browser.manifest, bytes: handoff.browser.manifest.bytes + 1 }));
  const changed = structuredClone(handoff);
  changed.browser.source.site.sha256 = "a".repeat(64);
  assert.throws(() => check(changed), /source identities/);
  const moved = structuredClone(handoff);
  moved.browser.directory = join(tmpdir(), "atlas-browser-other");
  assert.throws(() => check(moved));
  moved.browser.directory = "relative/browser";
  assert.throws(() => check(moved), /directory/);
});

test("Browser staging compresses absent objects, verifies public bytes and rejects incompatible existing assets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "atlas-browser-publish-"));
  const bytes = Buffer.from('{"synthetic":true}');
  let objectPath = "", puts = 0;
  const put = (key: string, path: string, compressed: boolean) => {
    assert.equal(key, "test/core.json.gz");
    assert(compressed);
    objectPath = path; puts++;
  };
  const read = async () => objectPath ? new Response(new Uint8Array(gunzipSync(await readFile(objectPath))), { headers: { "Content-Encoding": "gzip" } }) : new Response(null, { status: 404 });
  try {
    await stageBrowserAsset("test/core.json", bytes, directory, read, put);
    assert.equal(puts, 1);
    await stageBrowserAsset("test/core.json", bytes, directory, read, put);
    assert.equal(puts, 1);
    await assert.rejects(stageBrowserAsset("test/core.json", bytes, directory, async () => new Response("{}", { headers: { "Content-Encoding": "gzip" } }), put), /checksum/);
    await assert.rejects(stageBrowserAsset("test/core.json", bytes, directory, async () => new Response(bytes), put), /must use gzip/);
    assert.equal(puts, 1);
  } finally { await rm(directory, { recursive: true }); }
});
