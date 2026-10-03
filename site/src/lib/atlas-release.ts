import { z } from "zod";
import { parseAtlasJson, verifiedBytes } from "./atlas-json";
export { parseAtlasJson, verifiedBytes } from "./atlas-json";
import hosting from "../content-data/atlas-hosting.json";
import { selectorHashes, type AtlasMapSnapshot, type AtlasSiteBundle } from "./atlas-contract";
import type { AtlasBrowserCore, AtlasBrowserMap } from "./atlas-browser";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.object({ sha256: digest, bytes: z.number().int().positive() });
export const releaseSchema = z.object({
  version: z.literal(1), export_id: digest, published_at: z.iso.datetime(),
  cycle: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), mode: z.enum(["weekly", "initial"]),
  contract_version: z.enum(["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0"]), selector_sha256: digest,
  assets: z.object({ "atlas-site.json": asset, "map.json": asset, "metrics.json": asset, "network-transport.json": asset.optional() }),
  correction: z.object({ replaces_export_id: digest, authorization_sha256: digest }).optional(),
  intelligence: z.object({ experiment_id: digest, schema_version: z.literal("0.2.0"), asset }).optional(),
  browser: z.object({ transport_version: z.literal("0.1.0"), manifest: asset }).optional(),
});
export type AtlasRelease = z.infer<typeof releaseSchema>;
export type AtlasLoadProgress = { phase: "release" | "download" | "verify" | "prepare"; loaded: number; total: number };
export const atlasOrigin = process.env.NEXT_PUBLIC_ATLAS_DATA_ORIGIN ?? hosting.origin;
export function releaseRoot(release: AtlasRelease) { return `${atlasOrigin}/releases/${release.export_id}`; }
export const browserSelectorHashes = {
  "browser_transport.js": "0b659ae492e7d3ca8d4a82ac06f94206c0033aa1502524cd9d6d37dc53e3b814",
  "browser_tables.js": "80d72be4968bc7e865595b7cfda9e1cd49e633a50d8d2a6df119225c4661bddc",
  "site_view.js": "52e8459a8a3e90d0e55216fc2fef286f30e8a1de1801050bc4d71c2d6d4a3cb6",
};

export async function fetchAtlasData(signal?: AbortSignal, onProgress?: (progress: AtlasLoadProgress) => void) {
  signal?.throwIfAborted();
  onProgress?.({ phase: "release", loaded: 0, total: 0 });
  const response = await fetch(`${atlasOrigin}/current.json`, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`ATLAS release unavailable (${response.status})`);
  const release = releaseSchema.parse(await response.json());
  if (release.selector_sha256 !== selectorHashes[release.contract_version]) throw new Error("ATLAS selector requires a compatibility review");
  const root = releaseRoot(release);
  if (release.browser) {
    const { fetchBrowserManifest, prepareBrowserView, createAtlasDetailStore } = await import("./atlas-browser");
    const browserRoot = `${root}/browser/${release.browser.manifest.sha256}`;
    const manifest = await fetchBrowserManifest(browserRoot, release.browser.manifest, release, browserSelectorHashes, signal);
    const [coreBytes, mapBytes] = await downloadAssets(browserRoot, [manifest.core, manifest.map_core], manifest.assets, signal, onProgress);
    const core = await parseAtlasJson(coreBytes, signal) as AtlasBrowserCore;
    const snapshot = await parseAtlasJson(mapBytes, signal) as AtlasBrowserMap;
    signal?.throwIfAborted();
    const { data: bundle, select } = prepareBrowserView(core, release.export_id);
    if (bundle.contract_version !== release.contract_version || bundle.snapshot.source_snapshot_sha256 !== release.assets["map.json"].sha256 ||
        bundle.snapshot.metrics_sha256 !== manifest.source.metrics_sha256 || snapshot.transport_version !== release.browser.transport_version || snapshot.source_export_id !== release.export_id)
      throw new Error("ATLAS browser data does not match its release");
    return { bundle, snapshot, release, browser: { select, details: createAtlasDetailStore(browserRoot, manifest, { signal }) } };
  }
  const names = ["atlas-site.json", "map.json"] as const;
  const [bundleBytes, mapBytes] = await downloadAssets(root, names, release.assets, signal, onProgress);
  // Published bytes have passed ATLAS schema and evidence validation before the release pointer is written.
  const bundle = await parseAtlasJson(bundleBytes, signal) as AtlasSiteBundle;
  const snapshot = await parseAtlasJson(mapBytes, signal) as AtlasMapSnapshot;
  await new Promise(resolve => setTimeout(resolve, 0));
  signal?.throwIfAborted();
  if (bundle.contract_version !== release.contract_version || bundle.snapshot.source_snapshot_sha256 !== release.assets["map.json"].sha256)
    throw new Error("ATLAS release does not match its map input");
  return { bundle, snapshot, release, browser: undefined };
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
