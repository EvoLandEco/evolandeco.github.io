import type { AtlasData, AtlasMap, AtlasMapSnapshot, AtlasSiteBundle } from "./atlas-contract";
import type { AtlasBrowserSelector, AtlasDetailCollections, AtlasDetailLease, AtlasDetailRef } from "./atlas-browser";
import { createAtlas } from "./atlas";
import { createResearch } from "./atlas-comparisons";
import { createMetrics } from "./atlas-metrics";
import { createIdentities } from "./atlas-identities";

type Details = { acquire(refs: readonly AtlasDetailRef[], signal?: AbortSignal): Promise<AtlasDetailLease>; dispose(): void };

function archiveDetails(snapshot: AtlasMapSnapshot, bundle: AtlasSiteBundle): Details {
  const collections: { [K in keyof AtlasDetailCollections]: AtlasDetailCollections[K][] } = {
    assertions: bundle.assertions, evidence: bundle.evidence, comparisons: bundle.comparisons,
    "metrics.measures": bundle.metrics.measures,
    "metrics.reviewed_series": "reviewed_series" in bundle.metrics ? bundle.metrics.reviewed_series : [],
    "map.records": snapshot.records,
  };
  const indexes = new Map<keyof AtlasDetailCollections, Map<string, number>>();
  let disposed = false;
  return {
    async acquire(refs, signal) {
      signal?.throwIfAborted();
      if (disposed) throw new Error("ATLAS detail store is closed");
      const requested = new Set(refs.map(ref => JSON.stringify([ref.collection, "id" in ref ? ref.id : ref.ordinal])));
      let released = false;
      return {
        get<C extends keyof AtlasDetailCollections>(collection: C, key: string | number): AtlasDetailCollections[C] {
          if (released || disposed || signal?.aborted || !requested.has(JSON.stringify([collection, key]))) throw new Error("ATLAS source detail was not requested");
          const rows = collections[collection];
          if (typeof key === "string" && !indexes.has(collection)) {
            const index = new Map<string, number>();
            rows.forEach((row, ordinal) => {
              const id = collection === "metrics.measures" && "measure_id" in row ? row.measure_id : "series_id" in row ? row.series_id : "id" in row ? row.id : null;
              if (id !== null) index.set(id, ordinal);
            });
            indexes.set(collection, index);
          }
          const ordinal = typeof key === "number" ? key : indexes.get(collection)!.get(key);
          const row = ordinal === undefined ? undefined : rows[ordinal];
          if (!row) throw new Error("ATLAS source detail is missing");
          return row;
        },
        release() { released = true; },
      };
    },
    dispose() { disposed = true; indexes.clear(); },
  };
}

export function createAtlasStore<S extends AtlasMap, B extends AtlasData>(snapshot: S, bundle: B, browser?: { select: AtlasBrowserSelector; details: Details }) {
  const research = createResearch(bundle, browser?.select);
  let details = browser?.details;
  if (!details) {
    if (!("evidence" in bundle) || "transport_version" in snapshot) throw new Error("ATLAS source detail store is missing");
    details = archiveDetails(snapshot, bundle);
  }
  return { ...createAtlas(snapshot, bundle), ...research,
    ...createMetrics(bundle, research.selectedResearch), ...createIdentities(bundle, snapshot), details };
}
export type AtlasStore = ReturnType<typeof createAtlasStore>;
