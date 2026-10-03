import { z } from "zod";
import { parseAtlasJson, verifiedBytes } from "./atlas-json";
import type { AtlasRelease } from "./atlas-release";
import type { AtlasSiteBundle, AtlasMapSnapshot, AtlasReviewedSeries } from "./atlas-vendor/browser/atlas.js";
import type { AtlasBrowserDetailIndex, AtlasBrowserManifest } from "./atlas-vendor/browser/browser_transport.js";
export { decodeBrowserCore, prepareBrowserView, hydrateBrowserView } from "./atlas-vendor/browser/browser_transport.js";
export type { AtlasBrowserCore, AtlasBrowserData, AtlasBrowserMeasure, AtlasBrowserSelector, AtlasBrowserMap, AtlasBrowserSeries, AtlasBrowserManifest, AtlasBrowserSelection } from "./atlas-vendor/browser/browser_transport.js";

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.strictObject({ sha256: digest, bytes: z.number().int().positive().safe() });
const file = asset.extend({ path: z.string().min(1) });
const manifestSchema = z.strictObject({
  transport_version: z.literal("0.1.0"), source_export_id: digest,
  source: z.strictObject({ manifest: file, site: file, map: file, metrics_sha256: digest, site_contract_version: z.string(), selector: file }),
  core: z.string(), map_core: z.string(), detail_index: z.string(), selector: z.string(),
  assets: z.record(z.string(), asset.extend({ kind: z.string() })),
  partitions: z.array(z.strictObject({ path: z.string(), owner: z.string(), rows: z.number().int().nonnegative().safe() })),
  reconstruction: z.strictObject({ metadata: z.strictObject({ site: z.record(z.string(), z.unknown()), map: z.record(z.string(), z.unknown()) }), collections: z.record(z.string(), z.number().int().nonnegative().safe()) }),
});
export type AtlasBrowserDescriptor = { sha256: string; bytes: number };
function assetUrl(root: string, path: string) {
  if (!/^[A-Za-z0-9_./-]+$/.test(path) || path.split("/").some(part => !part || part === "." || part === "..")) throw new Error("Invalid ATLAS browser asset path");
  return `${root.replace(/\/$/, "")}/${path}`;
}

export async function fetchBrowserAsset(root: string, manifest: AtlasBrowserManifest, path: string, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const expected = manifest.assets[path];
  if (!expected) throw new Error(`Unknown ATLAS browser asset ${path}`);
  const bytes = await verifiedBytes(await fetch(assetUrl(root, path), { signal }), expected);
  signal?.throwIfAborted();
  return parseAtlasJson(bytes, signal);
}

export async function fetchBrowserManifest(root: string, descriptor: AtlasBrowserDescriptor, release: AtlasRelease, trustedSelectorHashes: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<AtlasBrowserManifest> {
  signal?.throwIfAborted();
  const checked = asset.parse(descriptor);
  const bytes = await verifiedBytes(await fetch(assetUrl(root, "manifest.json"), { signal }), checked);
  return validateBrowserManifest(await parseAtlasJson(bytes, signal), release, trustedSelectorHashes);
}

export function validateBrowserManifest(input: unknown, release: AtlasRelease, trustedSelectorHashes: Readonly<Record<string, string>>): AtlasBrowserManifest {
  const manifest = manifestSchema.parse(input);
  if (manifest.source_export_id !== release.export_id || manifest.source.site_contract_version !== release.contract_version ||
      manifest.source.selector.sha256 !== release.selector_sha256 ||
      manifest.source.site.sha256 !== release.assets["atlas-site.json"].sha256 || manifest.source.site.bytes !== release.assets["atlas-site.json"].bytes ||
      manifest.source.map.sha256 !== release.assets["map.json"].sha256 || manifest.source.map.bytes !== release.assets["map.json"].bytes) throw new Error("ATLAS browser transport source mismatch");
  for (const path of Object.keys(manifest.assets)) assetUrl("", path);
  for (const [path, kind] of [[manifest.core, "core"], [manifest.map_core, "map-core"], [manifest.detail_index, "detail-index"], [manifest.selector, "selector"]]) {
    if (manifest.assets[path]?.kind !== kind) throw new Error(`Invalid ATLAS browser ${kind} asset`);
  }
  const selectorAssets = Object.entries(manifest.assets).filter(([, value]) => value.kind === "selector");
  if (selectorAssets.length !== Object.keys(trustedSelectorHashes).length || selectorAssets.some(([path, value]) => trustedSelectorHashes[path] !== value.sha256)) throw new Error("ATLAS browser selector requires a compatibility review");
  const paths = new Set<string>();
  for (const partition of manifest.partitions) {
    if (paths.has(partition.path) || manifest.assets[partition.path]?.kind !== "detail") throw new Error("Invalid ATLAS detail partition inventory");
    paths.add(partition.path);
  }
  return manifest;
}

export type AtlasDetailCollections = {
  assertions: AtlasSiteBundle["assertions"][number];
  evidence: AtlasSiteBundle["evidence"][number];
  comparisons: AtlasSiteBundle["comparisons"][number];
  "metrics.measures": AtlasSiteBundle["metrics"]["measures"][number];
  "metrics.reviewed_series": AtlasReviewedSeries;
  "map.records": AtlasMapSnapshot["records"][number];
};
export type AtlasDetailRef<C extends keyof AtlasDetailCollections = keyof AtlasDetailCollections> = { collection: C } & ({ id: string } | { ordinal: number });
export type AtlasDetailLease = {
  get<C extends keyof AtlasDetailCollections>(collection: C, key: string | number): AtlasDetailCollections[C];
  release(): void;
};
type Task<T> = { promise: Promise<T>; controller: AbortController; users: number; settled: boolean };
function task<T>(run: (signal: AbortSignal) => Promise<T>): Task<T> {
  const result: Task<T> = { promise: undefined!, controller: new AbortController(), users: 0, settled: false };
  result.promise = run(result.controller.signal).finally(() => { result.settled = true; });
  return result;
}
function join<T>(running: Task<T>, signal: AbortSignal): Promise<T> {
  running.users++;
  return new Promise((resolve, reject) => {
    let finished = false;
    function finish(error: unknown, value?: T) {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", abort);
      running.users--;
      if (!running.users && !running.settled) running.controller.abort();
      if (error !== undefined) reject(error); else resolve(value!);
    }
    function abort() { finish(signal.reason); }
    running.promise.then(value => finish(undefined, value), error => finish(error));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
const wireCollection = (collection: string) => collection.startsWith("map.") ? collection : `site.${collection}`;
const entryKey = (collection: string, ordinal: number) => `${collection}:${ordinal}`;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0;
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function createAtlasDetailStore(root: string, manifest: AtlasBrowserManifest, options: { maxBytes?: number; signal?: AbortSignal } = {}) {
  const maxBytes = options.maxBytes ?? 32 * 1024 * 1024;
  if (!nonnegative(maxBytes)) throw new Error("Invalid ATLAS detail cache budget");
  type Index = { data: AtlasBrowserDetailIndex; ids: Map<string, Map<string, number>> };
  type Entry = { path: string; bytes: number; pins: number; used: number; data?: Map<string, unknown>; task?: Task<Map<string, unknown>> };
  let index: Index | undefined, indexTask: Task<Index> | undefined, clock = 0, closed = false;
  const entries = new Map<string, Entry>(), owners = new Map(manifest.partitions.map(partition => [partition.path, partition]));
  const leases = new Set<() => void>();
  const lifetime = new AbortController();
  function evict() {
    let size = [...entries.values()].reduce((sum, entry) => sum + (entry.data ? entry.bytes : 0), 0);
    for (const entry of [...entries.values()].sort((a, b) => a.used - b.used)) {
      if (size <= maxBytes) break;
      if (!entry.pins && entry.data) { entries.delete(entry.path); size -= entry.bytes; }
    }
  }
  function checkIndex(input: unknown): Index {
    if (!object(input) || !exactKeys(input, ["transport_version", "source_export_id", "partitions", "collections"]) || input.transport_version !== "0.1.0" || input.source_export_id !== manifest.source_export_id ||
        !Array.isArray(input.partitions) || input.partitions.length !== manifest.partitions.length || input.partitions.some((path, i) => path !== manifest.partitions[i].path) || !object(input.collections) ||
        !exactKeys(input.collections, Object.keys(manifest.reconstruction.collections))) throw new Error("Invalid ATLAS detail index");
    const ids = new Map<string, Map<string, number>>();
    const counts = new Map<string, number>();
    for (const [collection, rows] of Object.entries(input.collections)) {
      if (!Array.isArray(rows) || rows.length !== manifest.reconstruction.collections[collection]) throw new Error(`Invalid ATLAS detail index collection ${collection}`);
      const lookup = new Map<string, number>();
      for (const [ordinal, row] of rows.entries()) {
        if (!Array.isArray(row) || row.length !== 2 || (row[0] !== null && (typeof row[0] !== "string" || !row[0])) || !nonnegative(row[1]) || row[1] >= input.partitions.length) throw new Error("Invalid ATLAS detail index row");
        if (row[0] !== null) {
          if (lookup.has(row[0])) throw new Error(`Duplicate ATLAS detail identity ${row[0]}`);
          lookup.set(row[0], ordinal);
        }
        const path = input.partitions[row[1]] as string;
        counts.set(path, (counts.get(path) ?? 0) + 1);
      }
      ids.set(collection, lookup);
    }
    for (const partition of manifest.partitions) if ((counts.get(partition.path) ?? 0) !== partition.rows) throw new Error("ATLAS detail index partition count mismatch");
    return { data: input as unknown as AtlasBrowserDetailIndex, ids };
  }
  async function ensureIndex(signal: AbortSignal) {
    if (index) return index;
    if (!indexTask || indexTask.controller.signal.aborted) {
      const loading = task(async controller => checkIndex(await fetchBrowserAsset(root, manifest, manifest.detail_index, controller)));
      indexTask = loading;
      loading.promise.then(value => { if (!closed && !loading.controller.signal.aborted) index = value; }, () => {}).finally(() => { if (indexTask === loading) indexTask = undefined; });
    }
    return join(indexTask, signal);
  }
  function checkPartition(input: unknown, path: string, lookup: Index) {
    const owner = owners.get(path);
    if (!owner || !object(input) || !exactKeys(input, ["transport_version", "source_export_id", "owner", "rows"]) || input.transport_version !== "0.1.0" || input.source_export_id !== manifest.source_export_id ||
        input.owner !== owner.owner || !Array.isArray(input.rows) || input.rows.length !== owner.rows) throw new Error("Invalid ATLAS detail partition");
    const result = new Map<string, unknown>();
    for (const row of input.rows) {
      if (!object(row) || !exactKeys(row, ["collection", "ordinal", "id", "value"]) || typeof row.collection !== "string" || !nonnegative(row.ordinal)) throw new Error("Invalid ATLAS detail row");
      const expected = lookup.data.collections[row.collection]?.[row.ordinal];
      const key = entryKey(row.collection, row.ordinal);
      if (!expected || expected[0] !== row.id || lookup.data.partitions[expected[1]] !== path || result.has(key)) throw new Error("ATLAS detail row does not match its index");
      result.set(key, row.value);
    }
    return result;
  }
  function retain(path: string, lookup: Index) {
    let entry = entries.get(path);
    if (!entry || entry.task?.controller.signal.aborted) {
      entry = { path, bytes: manifest.assets[path].bytes, pins: 0, used: ++clock };
      const held = entry;
      entries.set(path, held);
      held.task = task(async signal => {
        const data = checkPartition(await fetchBrowserAsset(root, manifest, path, signal), path, lookup);
        signal.throwIfAborted();
        if (closed) throw new DOMException("ATLAS detail store is closed", "AbortError");
        held.data = data;
        evict();
        return data;
      });
      held.task.promise.catch(() => { if (entries.get(path) === held) entries.delete(path); }).finally(() => { held.task = undefined; });
    }
    entry.pins++;
    entry.used = ++clock;
    return entry;
  }
  function dispose() {
    if (closed) return;
    closed = true;
    options.signal?.removeEventListener("abort", dispose);
    lifetime.abort();
    indexTask?.controller.abort();
    for (const entry of entries.values()) entry.task?.controller.abort();
    for (const release of leases) release();
    entries.clear();
    index = undefined;
  }
  options.signal?.addEventListener("abort", dispose, { once: true });
  if (options.signal?.aborted) dispose();

  return {
    async acquire(refs: readonly AtlasDetailRef[], signal?: AbortSignal): Promise<AtlasDetailLease> {
      if (closed) throw new DOMException("ATLAS detail store is closed", "AbortError");
      signal?.throwIfAborted();
      const controller = new AbortController();
      const abort = () => controller.abort(signal?.reason ?? lifetime.signal.reason);
      signal?.addEventListener("abort", abort, { once: true });
      lifetime.signal.addEventListener("abort", abort, { once: true });
      const held: Entry[] = [], selected = new Map<string, Map<string | number, unknown>>();
      let released = false;
      function release() {
        if (released) return;
        released = true;
        for (const entry of held.splice(0)) entry.pins--;
        selected.clear();
        leases.delete(release);
        evict();
      }
      try {
        if (refs.length) {
          const lookup = await ensureIndex(controller.signal);
          controller.signal.throwIfAborted();
          const requested = refs.map(ref => {
            const collection = wireCollection(ref.collection), key = "id" in ref ? ref.id : ref.ordinal;
            if ((typeof key === "string" && !key) || (typeof key !== "string" && !nonnegative(key))) throw new Error("Invalid ATLAS detail reference");
            const ordinal = typeof key === "string" ? lookup.ids.get(collection)?.get(key) : key;
            const row = ordinal === undefined ? undefined : lookup.data.collections[collection]?.[ordinal];
            if (!row) throw new Error(`Missing ATLAS detail ${ref.collection}:${key}`);
            return { collection: ref.collection, key, rowKey: entryKey(collection, ordinal!), path: lookup.data.partitions[row[1]] };
          });
          for (const path of new Set(requested.map(row => row.path))) held.push(retain(path, lookup));
          await Promise.all(held.map(entry => entry.data ? Promise.resolve(entry.data) : join(entry.task!, controller.signal)));
          controller.signal.throwIfAborted();
          for (const row of requested) {
            const data = held.find(entry => entry.path === row.path)!.data!;
            if (!data.has(row.rowKey)) throw new Error(`Missing ATLAS detail ${row.collection}:${row.key}`);
            if (!selected.has(row.collection)) selected.set(row.collection, new Map());
            selected.get(row.collection)!.set(row.key, data.get(row.rowKey));
          }
        }
        leases.add(release);
        return { get<C extends keyof AtlasDetailCollections>(collection: C, key: string | number): AtlasDetailCollections[C] {
          if (released || closed) throw new Error("ATLAS detail lease is released");
          const values = selected.get(collection);
          if (!values?.has(key)) throw new Error(`ATLAS detail was not requested: ${collection}:${key}`);
          return values.get(key) as AtlasDetailCollections[C];
        }, release };
      } catch (error) {
        controller.abort();
        release();
        throw error;
      } finally {
        signal?.removeEventListener("abort", abort);
        lifetime.signal.removeEventListener("abort", abort);
      }
    },
    dispose,
    stats() {
      const loaded = [...entries.values()].filter(entry => entry.data);
      return { cachedBytes: loaded.reduce((sum, entry) => sum + entry.bytes, 0), pinnedBytes: loaded.filter(entry => entry.pins).reduce((sum, entry) => sum + entry.bytes, 0),
        partitions: loaded.length, pending: [...entries.values()].filter(entry => entry.task).length, indexBytes: index ? manifest.assets[manifest.detail_index].bytes : 0 };
    },
  };
}
export type AtlasDetailStore = ReturnType<typeof createAtlasDetailStore>;
