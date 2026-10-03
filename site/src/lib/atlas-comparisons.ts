import type { AtlasData, AtlasSiteBundle } from "./atlas-contract";
import type { AtlasBrowserSelector } from "./atlas-vendor/browser/browser.mjs";
import { selectView } from "./atlas-vendor/view.mjs";
import { selectView as selectReviewedView } from "./atlas-vendor/1.1/view.mjs";
import { selectView as selectChainView } from "./atlas-vendor/1.2/view.mjs";
import { selectView as selectDiseaseView } from "./atlas-vendor/1.3/view.mjs";
import { selectView as selectOneHealthView } from "./atlas-vendor/1.4/view.mjs";
import { selectView as selectPanelView } from "./atlas-vendor/1.5/view.mjs";
import type { AtlasOneHealthOptions, AtlasSelectedOneHealth, AtlasDiseaseComposition } from "./atlas-contract";
import type { AtlasReviewedSeries, AtlasSelectedChain } from "./atlas-contract";
function selectResearch(bundle: AtlasSiteBundle, ids: string[], options: AtlasOneHealthOptions = {}) {
  const { publication_from: from, publication_until: until } = bundle.snapshot;
  if (bundle.contract_version === "1.5.0") return selectPanelView(bundle, from, until, "publication", null, ids, options);
  if (bundle.contract_version === "1.4.0") return selectOneHealthView(bundle, from, until, "publication", null, ids, options);
  if (bundle.contract_version === "1.3.0") return { ...selectDiseaseView(bundle, from, until, "publication", null, ids), one_health: null as AtlasSelectedOneHealth | null };
  if (bundle.contract_version === "1.2.0") return { ...selectChainView(bundle, from, until, "publication", null, ids), disease_composition: null as AtlasDiseaseComposition | null, one_health: null as AtlasSelectedOneHealth | null };
  if (bundle.contract_version === "1.1.0") return { ...selectReviewedView(bundle, from, until, "publication", null, ids), reviewed_chains: [] as AtlasSelectedChain[], disease_composition: null as AtlasDiseaseComposition | null, one_health: null as AtlasSelectedOneHealth | null };
  return { ...selectView(bundle, from, until, "publication", null, ids), reviewed_series: [] as AtlasReviewedSeries[], reviewed_chains: [] as AtlasSelectedChain[], numeric_coverage: null, disease_composition: null as AtlasDiseaseComposition | null, one_health: null as AtlasSelectedOneHealth | null };
}
export type Comparison = AtlasData["comparisons"][number];
export function createResearch<B extends AtlasData>(bundle: B, browserSelect?: AtlasBrowserSelector) {
  const assertions = new Map<string, B["assertions"][number]>(bundle.assertions.map(a => [a.id, a]));
  const channels = new Map(bundle.channels.map(c => [c.id, c]));
  const select = (ids: string[], options: AtlasOneHealthOptions = {}) => {
    if (browserSelect) return browserSelect(bundle.snapshot.publication_from, bundle.snapshot.publication_until, "publication", null, ids, options);
    if (!("evidence" in bundle)) throw new Error("ATLAS browser selector is missing");
    return selectResearch(bundle, ids, options);
  };

  let selection: { ids: Set<string>; view: ReturnType<typeof select> } | undefined;
  function selectedResearch(recordIds: Set<string>) {
    if (!selection || selection.ids.size !== recordIds.size || [...recordIds].some(id => !selection!.ids.has(id))) {
      // Identical report selections share the producer's evidence view across panels.
      selection = { ids: new Set(recordIds), view: select([...recordIds]) };
    }
    return selection.view;
  }

  function reportComparisons(recordIds: Set<string>, reportIds: string[]) {
    const selected = new Set(selectedResearch(recordIds).comparison_ids);
    return bundle.comparisons.filter(c => selected.has(c.id) && c.participant_ids.some(id => reportIds.includes(assertions.get(id)!.record_id)));
  }

  function selectedOneHealth(recordIds: Set<string>, options: AtlasOneHealthOptions = {}): AtlasSelectedOneHealth | null {
    if (!Object.keys(options).length) return selectedResearch(recordIds).one_health;
    return select([...recordIds], options).one_health;
  }

  return { bundle, assertions, channels, selectedResearch, selectedOneHealth, reportComparisons };
}
