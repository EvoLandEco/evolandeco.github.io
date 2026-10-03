import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { resolve, dirname, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { gzipSync } from "node:zlib";
import { z } from "zod";
import hosting from "../src/content-data/atlas-hosting.json";
import { browserSelectorHashes, releaseSchema, verifiedBytes, type AtlasRelease } from "../src/lib/atlas-release";
import { validateBrowserManifest, type AtlasBrowserManifest } from "../src/lib/atlas-browser";

const site = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const fingerprint = (bytes: Uint8Array) => ({ bytes: bytes.byteLength, sha256: hash(bytes) });
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const file = z.strictObject({ path: z.string().min(1), bytes: z.number().int().positive().safe(), sha256: digest });
export const browserPublicationSchema = z.strictObject({
  format: z.literal("atlas-browser-publication/1"), destination: z.literal(hosting.origin), bucket: z.literal(hosting.bucket),
  approval_status: z.enum(["pending", "approved"]), authorization: z.strictObject({ thread_id: z.string().min(1), instruction: z.string().min(1) }),
  release: file, handoff: file,
  source: z.strictObject({ manifest: file, site: file, map: file, selector: file }),
  browser: z.strictObject({ manifest: file }),
});
type FileReference = z.infer<typeof file>;
async function checkedFile(ref: FileReference) {
  const digest = createHash("sha256");
  let bytes = 0;
  for await (const chunk of createReadStream(ref.path)) { digest.update(chunk); bytes += chunk.length; }
  assert.equal(bytes, ref.bytes, `File size mismatch: ${ref.path}`);
  assert.equal(digest.digest("hex"), ref.sha256, `File checksum mismatch: ${ref.path}`);
}
async function checkedJson(ref: FileReference) {
  const bytes = await readFile(ref.path);
  assert.deepEqual(fingerprint(bytes), { bytes: ref.bytes, sha256: ref.sha256 }, ref.path);
  return JSON.parse(bytes.toString());
}
export function attachBrowserDescriptor(base: Record<string, unknown>, descriptor: { sha256: string; bytes: number }) {
  releaseSchema.parse(base);
  const browser = { transport_version: "0.1.0" as const, manifest: descriptor };
  if (base.browser) assert.deepEqual(base.browser, browser, "Replacing a browser transport requires a separate review");
  const release = { ...base, browser };
  releaseSchema.parse(release);
  return release;
}
export function requireCurrentBrowserDescriptor(current: AtlasRelease, candidate: AtlasRelease) {
  if (current.export_id === candidate.export_id && current.browser)
    assert.deepEqual(candidate.browser, current.browser, "A same-export publication must preserve the current browser descriptor; use a matching source receipt");
}
const browserHandoffSchema = z.object({
  browser_handoff_version: z.literal("0.1.0"), source_export_id: digest, asset_count: z.number().int().positive(),
  producer_ready: z.literal(true), reconstruction: z.literal(true), all_records_individually: z.literal(true), pinned_selector_parity: z.literal(true),
  source_files_compared: z.tuple([z.literal("site"), z.literal("map")]), selection_cases: z.number().int().positive(),
  browser: z.object({ transport_version: z.literal("0.1.0"), source_export_id: digest, scientific_contract: z.string(), directory: z.string().refine(isAbsolute), manifest: file, source: z.record(z.string(), z.unknown()) }),
});
export function checkBrowserHandoff(handoff: unknown, manifest: AtlasBrowserManifest, reference: FileReference) {
  const parsed = browserHandoffSchema.parse(handoff);
  assert.equal(parsed.source_export_id, manifest.source_export_id);
  assert.equal(parsed.browser.source_export_id, manifest.source_export_id);
  assert.equal(parsed.asset_count, Object.keys(manifest.assets).length);
  assert.equal(parsed.browser.scientific_contract, manifest.source.site_contract_version);
  assert.deepEqual(parsed.browser.source, manifest.source, "Browser handoff source identities differ");
  assert.deepEqual(parsed.browser.manifest, reference, "Browser handoff manifest differs");
  assert.equal(resolve(parsed.browser.directory, "manifest.json"), reference.path);
  return parsed;
}

export async function prepareBrowserCandidate(handoffReference: FileReference, release: AtlasRelease) {
  const handoff = browserHandoffSchema.parse(await checkedJson(handoffReference));
  const reference = handoff.browser.manifest;
  const manifest = validateBrowserManifest(await checkedJson(reference), release, browserSelectorHashes);
  checkBrowserHandoff(handoff, manifest, reference);
  assert.equal(hash(JSON.stringify({ manifest_sha256: manifest.source.manifest.sha256, map_snapshot_sha256: manifest.source.map.sha256 })), release.export_id, "Scientific export identity mismatch");
  const descriptor = { sha256: reference.sha256, bytes: reference.bytes };
  const directory = handoff.browser.directory;
  const prefix = `releases/${release.export_id}/browser/${descriptor.sha256}`;
  const files = Object.entries(manifest.assets).map(([name, expected]) => ({ key: `${prefix}/${name}`, ...expected, path: resolve(directory, name) }));
  for (const ref of files) await checkedFile(ref);
  for (const name of [...Object.keys(browserSelectorHashes), "browser.d.mts", "atlas.d.ts"]) {
    const bytes = await readFile(resolve(site, "src/lib/atlas-vendor/browser", name));
    assert.equal(hash(bytes), manifest.assets[name]?.sha256, `Bundled browser runtime or type mismatch: ${name}`);
  }
  const core = await checkedJson({ path: resolve(directory, manifest.core), ...manifest.assets[manifest.core] });
  assert.equal(core.source_export_id, release.export_id);
  assert.equal(core.transport_version, manifest.transport_version);
  assert.equal(core.metadata.snapshot.metrics_sha256, manifest.source.metrics_sha256);
  assert.equal(core.metadata.snapshot.source_snapshot_sha256, manifest.source.map.sha256);
  const map = await checkedJson({ path: resolve(directory, manifest.map_core), ...manifest.assets[manifest.map_core] });
  assert.equal(map.source_export_id, release.export_id);
  assert.equal(map.transport_version, manifest.transport_version);
  files.push({ key: `${prefix}/manifest.json`, kind: "manifest", ...reference });
  return { handoff, manifest, descriptor, prefix, files };
}

export async function prepareBrowserPublication(authorizationPath: string) {
  const authorizationBytes = await readFile(authorizationPath);
  const authorization = browserPublicationSchema.parse(JSON.parse(authorizationBytes.toString()));
  const base = await checkedJson(authorization.release) as Record<string, unknown>;
  const checkedRelease = releaseSchema.parse(base);
  assert.equal(checkedRelease.contract_version, hosting.contract_version);
  assert.equal(checkedRelease.selector_sha256, hosting.selector_sha256);
  const prepared = await prepareBrowserCandidate(authorization.handoff, checkedRelease);
  assert.deepEqual(prepared.handoff.browser.manifest, authorization.browser.manifest);
  for (const name of ["manifest", "site", "map", "selector"] as const) {
    const ref = authorization.source[name];
    assert.deepEqual({ sha256: ref.sha256, bytes: ref.bytes }, { sha256: prepared.manifest.source[name].sha256, bytes: prepared.manifest.source[name].bytes }, `Source binding mismatch: ${name}`);
    await checkedFile(ref);
  }
  const sealed = await checkedJson(authorization.source.manifest);
  assert.equal(sealed.files["atlas-site.json"], prepared.manifest.source.site.sha256);
  assert.equal(sealed.files["view.mjs"], prepared.manifest.source.selector.sha256);
  const release = attachBrowserDescriptor(base, prepared.descriptor);
  return { authorization, authorizationBytes, base, checkedRelease, ...prepared, release };
}

export async function stageBrowserAsset(key: string, bytes: Buffer, directory: string, read: (key: string) => Promise<Response>, put: (key: string, path: string, compressed: boolean) => void) {
  const expected = fingerprint(bytes);
  const verify = async (response: Response) => {
    assert(response.ok, `Public browser asset unavailable (${response.status}): ${key}`);
    assert.equal(response.headers.get("Content-Encoding"), "gzip", `Public browser asset must use gzip: ${key}`);
    await verifiedBytes(response, expected);
  };
  const existing = await read(key);
  if (existing.status === 404) {
    const path = resolve(directory, key.replaceAll("/", "_") + ".gz");
    await writeFile(path, gzipSync(bytes, { level: 9 }));
    put(key + ".gz", path, true);
    await verify(await read(key));
  } else await verify(existing);
}

export async function publishBrowserTransport(authorizationPath: string, mode: "dry-run" | "stage" | "activate" = "dry-run", readIntervalMs = 0) {
  assert(Number.isSafeInteger(readIntervalMs) && readIntervalMs >= 0 && readIntervalMs <= 60_000, "Invalid public read interval");
  const cache = resolve(site, ".cache/atlas-sync");
  await mkdir(cache, { recursive: true });
  const lock = resolve(cache, "lock");
  await mkdir(lock);
  let activated = false;
  try {
    const plan = await prepareBrowserPublication(authorizationPath);
    if (mode === "dry-run") {
      console.log(JSON.stringify({ status: "validated", export_id: plan.checkedRelease.export_id, browser: plan.release.browser, assets: plan.files.length, activation_pending: true }));
      return;
    }
    assert.equal(plan.authorization.approval_status, "approved", "Public upload requires approval for this exact browser manifest");
    let lastRead = 0;
    const read = async (key: string) => {
      const wait = readIntervalMs - (Date.now() - lastRead);
      if (wait > 0) await new Promise(resolve => setTimeout(resolve, wait));
      lastRead = Date.now();
      const response = await fetch(`${hosting.origin}/${key}`, { cache: "no-cache" });
      assert(response.status !== 429, `Public read rate limit reached; Retry-After=${response.headers.get("Retry-After") ?? "unspecified"}. ${activated ? "Activation was written; verify current.json." : "The published pointer has not been changed."} Use --read-interval-ms to space verification requests.`);
      return response;
    };
    const current = async () => {
      const response = await read("current.json");
      assert(response.ok, `Cannot read public release: ${response.status}`);
      const value = await response.json();
      releaseSchema.parse(value);
      return value;
    };
    const before = await current();
    assert.deepEqual(before, plan.base, "Public release differs from the reviewed publication target");
    const directory = resolve(cache, `browser-${plan.release.browser.manifest.sha256}`);
    await mkdir(directory, { recursive: true });
    const put = (key: string, path: string, compressed: boolean) => execFileSync(process.execPath, [resolve(site, "node_modules/wrangler/bin/wrangler.js"), "r2", "object", "put", `${hosting.bucket}/${key}`, "--file", path, "--remote", "--content-type", /\.(?:mjs|js)\.gz$/.test(key) ? "text/javascript" : /\.d\.(?:mts|ts)\.gz$/.test(key) ? "text/plain" : "application/json", ...(compressed ? ["--content-encoding", "gzip"] : [])], { cwd: site, stdio: "inherit" });
    for (const ref of plan.files) {
      const bytes = await readFile(ref.path);
      assert.deepEqual(fingerprint(bytes), { bytes: ref.bytes, sha256: ref.sha256 }, ref.path);
      await stageBrowserAsset(ref.key, bytes, directory, read, put);
    }
    await stageBrowserAsset(`${plan.prefix}/release.json`, Buffer.from(JSON.stringify(plan.release)), directory, read, put);
    for (const ref of [plan.authorization.release, plan.authorization.handoff, ...Object.values(plan.authorization.source), plan.authorization.browser.manifest]) await checkedFile(ref);
    assert.deepEqual(await readFile(authorizationPath), plan.authorizationBytes, "Publication authorization changed");
    assert.deepEqual(await current(), before, "Public release changed during upload");
    const path = resolve(directory, "current.json");
    await writeFile(path, JSON.stringify(plan.release));
    if (mode === "activate") {
      put("current.json", path, false);
      activated = true;
      assert.deepEqual(await current(), plan.release, "Public activation readback mismatch");
    }
    const receipt = { status: activated ? "published" : "staged", release: plan.release, authorization_sha256: hash(plan.authorizationBytes), activation_pending: !activated };
    await writeFile(resolve(directory, "receipt.json"), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify({ status: receipt.status, export_id: plan.checkedRelease.export_id, manifest_sha256: plan.release.browser.manifest.sha256, receipt: resolve(directory, "receipt.json") }));
  } finally { await rm(lock, { recursive: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { values } = parseArgs({ options: { authorization: { type: "string" }, "dry-run": { type: "boolean", default: false }, stage: { type: "boolean", default: false }, activate: { type: "boolean", default: false }, "read-interval-ms": { type: "string", default: "0" } } });
  assert(values.authorization, "Supply --authorization");
  assert([values["dry-run"], values.stage, values.activate].filter(Boolean).length <= 1, "Choose one publication mode");
  publishBrowserTransport(resolve(values.authorization), values.activate ? "activate" : values.stage ? "stage" : "dry-run", Number(values["read-interval-ms"])).catch(error => { console.error(error); process.exitCode = 1; });
}
