import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAtlasDetailStore, fetchBrowserManifest, fetchBrowserAsset, prepareBrowserView, hydrateBrowserView, type AtlasBrowserCore, type AtlasBrowserManifest } from "../src/lib/atlas-browser";
import { browserSelectorHashes, type AtlasRelease } from "../src/lib/atlas-release";
import fixture from "./atlas-fixture.json";

const root = "https://atlas.invalid/browser/test";
const fingerprint = (bytes: Uint8Array) => ({ sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength });
function setup(version: "0.3.0" = "0.3.0") {
  const release = fixture.release as AtlasRelease;
  const bodies = new Map<string, Buffer>();
  const assets: AtlasBrowserManifest["assets"] = {};
  const add = (path: string, value: unknown, kind: string) => {
    const body = Buffer.from(JSON.stringify(value));
    bodies.set(`${root}/${path}`, body);
    assets[path] = { ...fingerprint(body), kind };
  };
  const evidence = ["a", "b", "c"].map(id => ({ id, quote: `Synthetic quotation ${id}`, record_id: `r${id}`, document_id: `d${id}` }));
  const partitions = evidence.map((value, ordinal) => {
    const path = `details/${value.id}.json`, owner = `document:d${value.id}`;
    add(path, { transport_version: version, source_export_id: release.export_id, owner, rows: [{ collection: "site.evidence", ordinal, id: value.id, value }] }, "detail");
    return { path, owner, rows: 1 };
  });
  const index = { transport_version: version, source_export_id: release.export_id, partitions: partitions.map(row => row.path), collections: { "site.evidence": evidence.map((row, i) => [row.id, i]) } };
  add("detail-index.json", index, "detail-index");
  add("core.json", {}, "core");
  add("map-core.json", {}, "map-core");
  const trusted = { "browser_transport.js": "a".repeat(64) };
  assets["browser_transport.js"] = { sha256: trusted["browser_transport.js"], bytes: 10, kind: "selector" };
  const manifest: AtlasBrowserManifest = { transport_version: version, source_export_id: release.export_id,
    source: { manifest: { path: "manifest.json", sha256: "b".repeat(64), bytes: 10 }, site: { path: "atlas-site.json", ...release.assets["atlas-site.json"] },
      map: { path: "map.json", ...release.assets["map.json"] }, metrics_sha256: "c".repeat(64), site_contract_version: release.contract_version,
      selector: { path: "view.mjs", sha256: release.selector_sha256, bytes: 10 } },
    core: "core.json", map_core: "map-core.json", detail_index: "detail-index.json", selector: "browser_transport.js", assets, partitions,
    reconstruction: { metadata: { site: {}, map: {} }, collections: { "site.evidence": evidence.length } } };
  const manifestBytes = () => Buffer.from(JSON.stringify(manifest));
  return { release, manifest, bodies, evidence, add, trusted, manifestBytes, index };
}

test("Browser manifests bind byte verification, the scientific source and all executable assets", async t => {
  const f = setup();
  t.mock.method(globalThis, "fetch", async () => new Response(f.manifestBytes()));
  const read = (trusted = f.trusted) => fetchBrowserManifest(root, fingerprint(f.manifestBytes()), f.release, trusted);
  assert.equal((await read()).source_export_id, f.release.export_id);
  await assert.rejects(fetchBrowserManifest(root, { ...fingerprint(f.manifestBytes()), sha256: "0".repeat(64) }, f.release, f.trusted), /checksum/);
  await assert.rejects(read({ "browser_transport.js": "d".repeat(64) }), /compatibility/);
  f.manifest.assets["hidden.js"] = { sha256: "d".repeat(64), bytes: 10, kind: "selector" };
  await assert.rejects(read(), /compatibility/);
  delete f.manifest.assets["hidden.js"];
  f.manifest.assets["../elsewhere.json"] = { sha256: "d".repeat(64), bytes: 10, kind: "detail" };
  await assert.rejects(read(), /asset path/);
  delete f.manifest.assets["../elsewhere.json"];
  f.manifest.source.map.bytes++;
  await assert.rejects(read(), /source mismatch/);
});

test("Transport 0.3 binds manifest, index and partitions to one version", async t => {
  const f = setup("0.3.0");
  t.mock.method(globalThis, "fetch", async (url: string) => new Response((url.endsWith("/manifest.json") ? f.manifestBytes() : f.bodies.get(url))?.toString("utf8")));
  const release = { ...f.release, browser: { transport_version: "0.3.0" as const, manifest: fingerprint(f.manifestBytes()) } };
  await fetchBrowserManifest(root, fingerprint(f.manifestBytes()), release, f.trusted);
  await assert.rejects(fetchBrowserManifest(root, fingerprint(f.manifestBytes()), { ...release, browser: { ...release.browser, transport_version: "0.1.0" } }, f.trusted), /version mismatch/);
  const store = createAtlasDetailStore(root, f.manifest);
  const lease = await store.acquire([{ collection: "evidence", id: "a" }]);
  assert.deepEqual(lease.get("evidence", "a"), f.evidence[0]);
  lease.release(); store.dispose();
  for (const asset of ["detail-index.json", "details/a.json"]) {
    const original = JSON.parse(f.bodies.get(`${root}/${asset}`)!.toString());
    f.add(asset, { ...original, transport_version: "0.1.0" }, f.manifest.assets[asset].kind);
    const invalid = createAtlasDetailStore(root, f.manifest);
    await assert.rejects(invalid.acquire([{ collection: "evidence", id: "a" }]), /Invalid ATLAS detail/);
    invalid.dispose();
    f.add(asset, original, f.manifest.assets[asset].kind);
  }
});

test("Detail leases request exact entities, share downloads and evict unpinned bytes in usage order", async t => {
  const f = setup(), fetched: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => { fetched.push(url); return new Response(f.bodies.get(url)?.toString("utf8") ?? null, { status: f.bodies.has(url) ? 200 : 404 }); });
  const one = f.manifest.assets["details/a.json"].bytes;
  const store = createAtlasDetailStore(root, f.manifest, { maxBytes: one * 2 });
  const [first, duplicate] = await Promise.all([store.acquire([{ collection: "evidence", id: "a" }]), store.acquire([{ collection: "evidence", id: "a" }])]);
  assert.deepEqual(first.get("evidence", "a"), f.evidence[0]);
  assert.strictEqual(first.get("evidence", "a"), duplicate.get("evidence", "a"));
  assert.equal(fetched.filter(url => url.endsWith("/detail-index.json")).length, 1);
  assert.equal(fetched.filter(url => url.endsWith("/details/a.json")).length, 1);
  assert.throws(() => first.get("evidence", "b"), /not requested/);
  first.release(); duplicate.release();
  assert.throws(() => first.get("evidence", "a"), /released/);
  const second = await store.acquire([{ collection: "evidence", ordinal: 1 }]);
  assert.deepEqual(second.get("evidence", 1), f.evidence[1]);
  second.release();
  const recent = await store.acquire([{ collection: "evidence", id: "a" }]);
  recent.release();
  const third = await store.acquire([{ collection: "evidence", id: "c" }]);
  third.release();
  assert.equal(store.stats().cachedBytes, one * 2);
  const retained = await store.acquire([{ collection: "evidence", id: "a" }]);
  assert.equal(fetched.filter(url => url.endsWith("/details/a.json")).length, 1);
  const reloaded = await store.acquire([{ collection: "evidence", id: "b" }]);
  assert.equal(fetched.filter(url => url.endsWith("/details/b.json")).length, 2);
  retained.release(); reloaded.release();
  await assert.rejects(store.acquire([{ collection: "evidence", id: "missing" }]), /Missing ATLAS detail/);
  assert(!fetched.some(url => url.includes("missing")));
  store.dispose();
  assert.equal(store.stats().cachedBytes, 0);
  await assert.rejects(store.acquire([{ collection: "evidence", id: "a" }]), { name: "AbortError" });
});

test("Visible detail leases survive the byte budget and cancellation does not stop another reader", async t => {
  const f = setup();
  let continueFetch!: () => void, started!: () => void, aborted = 0;
  const gate = new Promise<void>(resolve => { continueFetch = resolve; });
  const pending = new Promise<void>(resolve => { started = resolve; });
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/details/a.json")) {
      started();
      await Promise.race([gate, new Promise((_, reject) => init.signal?.addEventListener("abort", () => { aborted++; reject(init.signal!.reason); }, { once: true }))]);
    }
    return new Response(f.bodies.get(url)?.toString("utf8"));
  });
  const store = createAtlasDetailStore(root, f.manifest, { maxBytes: 0 });
  const controller = new AbortController();
  const cancelled = store.acquire([{ collection: "evidence", id: "a" }], controller.signal);
  const survivor = store.acquire([{ collection: "evidence", id: "a" }]);
  const rejection = assert.rejects(cancelled, { name: "AbortError" });
  await pending;
  controller.abort();
  await rejection;
  assert.equal(aborted, 0);
  continueFetch();
  const lease = await survivor;
  assert.equal(lease.get("evidence", "a").quote, f.evidence[0].quote);
  assert(store.stats().pinnedBytes > 0);
  lease.release();
  assert.equal(store.stats().cachedBytes, 0);
  store.dispose();
});

test("Cancelled sole readers abort requests, and corrupt or mismatched detail assets never enter the cache", async t => {
  const f = setup();
  let started!: () => void, aborted!: () => void;
  const pending = new Promise<void>(resolve => { started = resolve; });
  const stopped = new Promise<void>(resolve => { aborted = resolve; });
  let mode: "blocked" | "corrupt" | "mismatched" | "valid" = "blocked";
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/details/a.json") && mode === "blocked") {
      started();
      return new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => { aborted(); reject(init.signal!.reason); }, { once: true }));
    }
    if (url.endsWith("/details/a.json") && mode === "corrupt") return new Response("{}");
    return new Response(f.bodies.get(url)?.toString("utf8"));
  });
  const store = createAtlasDetailStore(root, f.manifest);
  const controller = new AbortController();
  const request = store.acquire([{ collection: "evidence", id: "a" }], controller.signal);
  const rejected = assert.rejects(request, { name: "AbortError" });
  await pending;
  controller.abort();
  await Promise.all([rejected, stopped]);
  mode = "corrupt";
  await assert.rejects(store.acquire([{ collection: "evidence", id: "a" }]), /checksum/);
  assert.equal(store.stats().cachedBytes, 0);
  const original = JSON.parse(f.bodies.get(`${root}/details/a.json`)!.toString());
  mode = "mismatched";
  f.add("details/a.json", { ...original, source_export_id: "0".repeat(64) }, "detail");
  await assert.rejects(store.acquire([{ collection: "evidence", id: "a" }]), /Invalid ATLAS detail partition/);
  f.add("details/a.json", { ...original, rows: [{ ...original.rows[0], id: "wrong" }] }, "detail");
  await assert.rejects(store.acquire([{ collection: "evidence", id: "a" }]), /does not match/);
  mode = "valid";
  f.add("details/a.json", original, "detail");
  const lease = await store.acquire([{ collection: "evidence", id: "a" }]);
  store.dispose();
  assert.throws(() => lease.get("evidence", "a"), /released/);
  lease.release();
  assert.equal(store.stats().cachedBytes, 0);
});

test("Producer transport preserves source-bound values and serves only requested detail partitions", { skip: !process.env.ATLAS_BROWSER_CANDIDATE }, async t => {
  const directory = process.env.ATLAS_BROWSER_CANDIDATE!;
  assert(process.env.ATLAS_RELEASE_FILE, "ATLAS_RELEASE_FILE must identify the transport's scientific release");
  const release = JSON.parse(await readFile(process.env.ATLAS_RELEASE_FILE, "utf8")) as AtlasRelease;
  const bytes = await readFile(path.join(directory, "manifest.json"));
  const pinned = browserSelectorHashes[(JSON.parse(bytes.toString()) as AtlasBrowserManifest).transport_version];
  const fetched: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    init.signal?.throwIfAborted();
    assert(url.startsWith(`${root}/`));
    fetched.push(url.slice(root.length + 1));
    return new Response(new Uint8Array(await readFile(path.join(directory, url.slice(root.length + 1)))));
  });
  const manifest = await fetchBrowserManifest(root, fingerprint(bytes), release, pinned);
  const core = await fetchBrowserAsset(root, manifest, manifest.core) as AtlasBrowserCore;
  const prepared = prepareBrowserView(core, release.export_id);
  assert.equal(prepared.data.snapshot.metrics_sha256, manifest.source.metrics_sha256);
  const summary = prepared.data.metrics.measures[0];
  const view = prepared.select(prepared.data.snapshot.publication_from, prepared.data.snapshot.publication_until);
  const series = view.reviewed_series[0];
  const store = createAtlasDetailStore(root, manifest, { maxBytes: 0 });
  const lease = await store.acquire([{ collection: "metrics.measures", id: summary.measure_id }, { collection: "map.records", id: summary.source_record_id }, { collection: "metrics.reviewed_series", id: series.series_id }]);
  const full = lease.get("metrics.measures", summary.measure_id);
  assert.equal(full.value, summary.value);
  assert.equal(full.value_status, summary.value_status);
  assert.equal(full.unit, summary.unit);
  assert.deepEqual(full.evidence_references.map(row => row.record_id), summary.evidence_record_ids);
  assert(lease.get("map.records", summary.source_record_id).claims.length > 0);
  const hydrated = hydrateBrowserView({ ...view, reviewed_series: [series] }, new Map([[series.series_id, lease.get("metrics.reviewed_series", series.series_id)]]));
  assert.deepEqual(hydrated.reviewed_series[0].evidence.map(row => row.id).sort(), [...series.evidence_ids].sort());
  assert(fetched.filter(name => name.startsWith("details/")).length < manifest.partitions.length);
  assert(!fetched.includes("atlas-site.json"));
  assert(!fetched.includes("map.json"));
  lease.release();
  assert.equal(store.stats().cachedBytes, 0);
  store.dispose();
});
