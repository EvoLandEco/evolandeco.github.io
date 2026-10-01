import { z } from "zod";
import hosting from "../content-data/atlas-hosting.json";
import { selectorHashes, type AtlasMapSnapshot, type AtlasSiteBundle } from "./atlas-contract";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.object({ sha256: digest, bytes: z.number().int().positive() });
export const releaseSchema = z.object({
  version: z.literal(1), export_id: digest, published_at: z.iso.datetime(),
  cycle: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), mode: z.enum(["weekly", "initial"]),
  contract_version: z.enum(["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0"]), selector_sha256: digest,
  assets: z.object({ "atlas-site.json": asset, "map.json": asset, "metrics.json": asset, "network-transport.json": asset.optional() }),
  correction: z.object({ replaces_export_id: digest, authorization_sha256: digest }).optional(),
  intelligence: z.object({ experiment_id: digest, schema_version: z.literal("0.2.0"), asset }).optional(),
});
export type AtlasRelease = z.infer<typeof releaseSchema>;
export type AtlasLoadProgress = { phase: "release" | "download" | "verify" | "prepare"; loaded: number; total: number };
export const atlasOrigin = process.env.NEXT_PUBLIC_ATLAS_DATA_ORIGIN ?? hosting.origin;
export function releaseRoot(release: AtlasRelease) { return `${atlasOrigin}/releases/${release.export_id}`; }

export async function verifiedBytes(response: Response, expected: { sha256: string; bytes: number }, onProgress?: (loaded: number) => void) {
  if (!response.ok) throw new Error(`ATLAS download failed (${response.status})`);
  let bytes: ArrayBuffer;
  if (onProgress && response.body) {
    const buffer = new Uint8Array(expected.bytes);
    const reader = response.body.getReader();
    let loaded = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (loaded + value.byteLength > expected.bytes) {
          await reader.cancel();
          throw new Error("ATLAS download checksum mismatch");
        }
        buffer.set(value, loaded);
        loaded += value.byteLength;
        onProgress(loaded);
      }
    } finally { reader.releaseLock(); }
    if (loaded !== expected.bytes) throw new Error("ATLAS download checksum mismatch");
    bytes = buffer.buffer;
  } else bytes = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  if (bytes.byteLength !== expected.bytes || hash !== expected.sha256) throw new Error("ATLAS download checksum mismatch");
  return bytes;
}

export async function fetchAtlasData(signal?: AbortSignal, onProgress?: (progress: AtlasLoadProgress) => void) {
  signal?.throwIfAborted();
  onProgress?.({ phase: "release", loaded: 0, total: 0 });
  const response = await fetch(`${atlasOrigin}/current.json`, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`ATLAS release unavailable (${response.status})`);
  const release = releaseSchema.parse(await response.json());
  if (release.selector_sha256 !== selectorHashes[release.contract_version]) throw new Error("ATLAS selector requires a compatibility review");
  const root = releaseRoot(release);
  const names = ["atlas-site.json", "map.json"] as const;
  const total = names.reduce((sum, name) => sum + release.assets[name].bytes, 0);
  const received = [0, 0];
  let lastPercent = 0;
  onProgress?.({ phase: "download", loaded: 0, total });
  const [bundleBytes, mapBytes] = await Promise.all(names.map(async (name, index) =>
    verifiedBytes(await fetch(`${root}/${name}`, { signal }), release.assets[name], onProgress ? loaded => {
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
  await new Promise(resolve => setTimeout(resolve, 0));
  signal?.throwIfAborted();
  // Published bytes have passed ATLAS schema and evidence validation before the release pointer is written.
  const bundleText = new TextDecoder().decode(bundleBytes);
  const mapText = new TextDecoder().decode(mapBytes);
  // Decoding, parsing and indexing run in separate tasks so input can be handled between them.
  await new Promise(resolve => setTimeout(resolve, 0));
  signal?.throwIfAborted();
  const bundle: AtlasSiteBundle = JSON.parse(bundleText);
  const snapshot: AtlasMapSnapshot = JSON.parse(mapText);
  await new Promise(resolve => setTimeout(resolve, 0));
  signal?.throwIfAborted();
  if (bundle.contract_version !== release.contract_version || bundle.snapshot.source_snapshot_sha256 !== release.assets["map.json"].sha256)
    throw new Error("ATLAS release does not match its map input");
  return { bundle, snapshot, release };
}
