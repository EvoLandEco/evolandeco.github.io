import type { AtlasMapSnapshot, AtlasSiteBundle } from "./atlas-contract";
import { createAtlas } from "./atlas";
import { createResearch } from "./atlas-comparisons";
import { createMetrics } from "./atlas-metrics";
import { createIdentities } from "./atlas-identities";

export function createAtlasStore(snapshot: AtlasMapSnapshot, bundle: AtlasSiteBundle) {
  const research = createResearch(bundle);
  return { ...createAtlas(snapshot, bundle), ...research,
    ...createMetrics(bundle, research.selectedResearch), ...createIdentities(bundle, snapshot) };
}
export type AtlasStore = ReturnType<typeof createAtlasStore>;
