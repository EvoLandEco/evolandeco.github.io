import { z } from "zod";
import hosting from "../content-data/atlas-hosting.json";
import { selectorHashes, type AtlasMapSnapshot, type AtlasSiteBundle } from "./atlas-contract";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.object({ sha256: digest, bytes: z.number().int().positive() });
export const releaseSchema = z.object({
  version: z.literal(1), export_id: digest, published_at: z.iso.datetime(),
  cycle: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), mode: z.enum(["weekly", "initial"]),
  contract_version: z.enum(["1.0.0", "1.1.0", "1.2.0"]), selector_sha256: digest,
  assets: z.object({ "atlas-site.json": asset, "map.json": asset, "metrics.json": asset }),
  correction: z.object({ replaces_export_id: digest, authorization_sha256: digest }).optional(),
});
export type AtlasRelease = z.infer<typeof releaseSchema>;
export const atlasOrigin = process.env.NEXT_PUBLIC_ATLAS_DATA_ORIGIN ?? hosting.origin;
export function releaseRoot(release: AtlasRelease) { return `${atlasOrigin}/releases/${release.export_id}`; }

export async function verifiedBytes(response: Response, expected: { sha256: string; bytes: number }) {
  if (!response.ok) throw new Error(`ATLAS download failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
  if (bytes.byteLength !== expected.bytes || hash !== expected.sha256) throw new Error("ATLAS download checksum mismatch");
  return bytes;
}

export async function fetchAtlasData(signal?: AbortSignal) {
  const response = await fetch(`${atlasOrigin}/current.json`, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`ATLAS release unavailable (${response.status})`);
  const release = releaseSchema.parse(await response.json());
  if (release.selector_sha256 !== selectorHashes[release.contract_version]) throw new Error("ATLAS selector requires a compatibility review");
  const root = releaseRoot(release);
  const [bundleBytes, mapBytes] = await Promise.all(["atlas-site.json", "map.json"].map(async name =>
    verifiedBytes(await fetch(`${root}/${name}`, { signal }), release.assets[name as keyof typeof release.assets])));
  // Published bytes have passed ATLAS schema and evidence validation before the release pointer is written.
  const bundle: AtlasSiteBundle = JSON.parse(new TextDecoder().decode(bundleBytes));
  const snapshot: AtlasMapSnapshot = JSON.parse(new TextDecoder().decode(mapBytes));
  if (bundle.contract_version !== release.contract_version || bundle.snapshot.source_snapshot_sha256 !== release.assets["map.json"].sha256)
    throw new Error("ATLAS release does not match its map input");
  return { bundle, snapshot, release };
}
