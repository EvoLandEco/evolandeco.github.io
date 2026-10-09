import { z } from "zod";
import { parseAtlasJson, verifiedBytes } from "./atlas-json";
export { parseAtlasJson, verifiedBytes } from "./atlas-json";
import hosting from "../content-data/atlas-hosting.json";
import { atlasContractVersion, atlasSelectorSha256 } from "./atlas-contract";
import type { AtlasBrowserCore, AtlasBrowserMap } from "./atlas-browser";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.object({ sha256: digest, bytes: z.number().int().positive() });
const supplementDescriptor = z.discriminatedUnion("path", [
  z.strictObject({ version: z.literal("0.1.0"), source_export_id: digest,
    path: z.literal("source-supplement.json"), schema_path: z.literal("source-supplement.schema.json"),
    sha256: digest, bytes: z.number().int().positive().safe(), schema_sha256: z.literal("2314d67db4e9cf1c7c0abab880e5644c21320f2a03fa43bd01a41e6c3015ac01") }),
  z.strictObject({ version: z.literal("0.1.0"), source_export_id: digest,
    path: z.literal("source-supplement-collection.json"), schema_path: z.literal("source-supplement-collection.schema.json"),
    sha256: digest, bytes: z.number().int().positive().max(2_000_000), schema_sha256: z.literal("507299f1b27126249371b2d1c5493400eb71f207b18f00ab7bd4f430739d8997") }),
]);
export const releaseSchema = z.object({
  version: z.literal(1), export_id: digest, published_at: z.iso.datetime(),
  cycle: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), mode: z.enum(["weekly", "initial"]),
  contract_version: z.enum(["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0", "1.6.0", "1.7.0", "1.8.0"]), selector_sha256: digest,
  assets: z.object({ "atlas-site.json": asset, "map.json": asset, "metrics.json": asset, "network-transport.json": asset.optional() }),
  source_supplement: supplementDescriptor.optional(),
  source_text: z.object({ version: z.literal("0.1.0"), source_export_id: digest, catalogue_sha256: digest,
    path: z.literal("source-text-display.json"), schema_path: z.literal("source-text-display.schema.json"),
    sha256: digest, bytes: z.number().int().positive(), schema_sha256: z.literal("5d31be301360faa5aae9c4dd162511641f346b79bad6d3440b87290eefdacd30") }).optional(),
  watch: z.object({ version: z.literal("0.1.0"), source_export_id: digest,
    path: z.literal("watch.json"), schema_path: z.literal("watch.schema.json"),
    sha256: digest, bytes: z.number().int().positive(), schema_sha256: z.literal("6029955be2f9c4e22c247c1f0e9a127c6251b422463d242b9a35a75101579caa") }).optional(),
  correction: z.object({ replaces_export_id: digest, authorization_sha256: digest }).optional(),
  intelligence: z.object({ experiment_id: digest, schema_version: z.literal("0.2.0"), asset }).optional(),
  browser: z.object({ transport_version: z.enum(["0.1.0", "0.2.0", "0.3.0"]), manifest: asset }).optional(),
});
export const uiReleaseSchema = releaseSchema.extend({
  contract_version: z.literal(atlasContractVersion),
  selector_sha256: z.literal(atlasSelectorSha256),
  browser: z.object({ transport_version: z.literal("0.3.0"), manifest: asset }),
});
export type AtlasRelease = z.infer<typeof releaseSchema>;
export type AtlasLoadProgress = { phase: "release" | "download" | "verify" | "prepare"; loaded: number; total: number };
export const atlasOrigin = process.env.NEXT_PUBLIC_ATLAS_DATA_ORIGIN ?? hosting.origin;
export function releaseRoot(release: AtlasRelease) { return `${atlasOrigin}/releases/${release.export_id}`; }
export const browserSelectorHashes = {
 "0.3.0": {
  "browser_transport.js": "89b041aa41b019ff86147541aaa06f70acc3750c3c1f35922d6bab25251a3af8",
  "browser_tables.js": "8bcb8842d6cd0f17ac8ff51451d28b2e1116b936fdf4c4ad611f62cb2e6f6208",
  "site_view.js": "eeb1ed08365086de8f97a1b952405927f9948f3c61ffde538f401dab4c083136"
 },
};

export async function fetchAtlasData(signal?: AbortSignal, onProgress?: (progress: AtlasLoadProgress) => void) {
  signal?.throwIfAborted();
  onProgress?.({ phase: "release", loaded: 0, total: 0 });
  const response = await fetch(`${atlasOrigin}/current.json`, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`ATLAS release unavailable (${response.status})`);
  const release = uiReleaseSchema.parse(await response.json());
  if (release.source_supplement && release.source_supplement.source_export_id !== release.export_id) throw new Error("ATLAS supplement release binding mismatch");
  const root = releaseRoot(release);
  const { fetchBrowserManifest, prepareBrowserView, createAtlasDetailStore } = await import("./atlas-browser");
  const browserRoot = `${root}/browser/${release.browser.manifest.sha256}`;
  const manifest = await fetchBrowserManifest(browserRoot, release.browser.manifest, release, browserSelectorHashes[release.browser.transport_version], signal);
  const [coreBytes, mapBytes] = await downloadAssets(browserRoot, [manifest.core, manifest.map_core], manifest.assets, signal, onProgress);
  const core = await parseAtlasJson(coreBytes, signal) as AtlasBrowserCore;
  const snapshot = await parseAtlasJson(mapBytes, signal) as AtlasBrowserMap;
  signal?.throwIfAborted();
  if (core.transport_version !== manifest.transport_version) throw new Error("ATLAS browser core version mismatch");
  const { data: bundle, select } = prepareBrowserView(core, release.export_id);
  if (bundle.contract_version !== release.contract_version || bundle.snapshot.source_snapshot_sha256 !== release.assets["map.json"].sha256 ||
      bundle.snapshot.metrics_sha256 !== manifest.source.metrics_sha256 || snapshot.transport_version !== release.browser.transport_version || snapshot.source_export_id !== release.export_id)
    throw new Error("ATLAS browser data does not match its release");
  return { bundle, snapshot, release, scientificManifestSha256: manifest.source.manifest.sha256, browser: { select, details: createAtlasDetailStore(browserRoot, manifest, { signal }) } };
}

async function downloadAssets(root: string, names: readonly [string, string], assets: Record<string, { bytes: number; sha256: string }>, signal?: AbortSignal, onProgress?: (progress: AtlasLoadProgress) => void) {
  const total = names.reduce((sum, name) => sum + assets[name].bytes, 0);
  const received = [0, 0];
  let lastPercent = 0;
  onProgress?.({ phase: "download", loaded: 0, total });
  const downloaded = await Promise.all(names.map(async (name, index) =>
    verifiedBytes(await fetch(`${root}/${name}`, { signal }), assets[name], onProgress ? loaded => {
      if (signal?.aborted) return;
      received[index] = loaded;
      const sum = received[0] + received[1];
      const percent = Math.floor(sum / total * 100);
      if (percent !== lastPercent) {
        lastPercent = percent;
        onProgress({ phase: sum === total ? "verify" : "download", loaded: sum, total });
      }
    } : undefined)));
  signal?.throwIfAborted();
  onProgress?.({ phase: "prepare", loaded: total, total });
  return downloaded;
}
