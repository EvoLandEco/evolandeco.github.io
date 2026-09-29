import type { AtlasSiteBundle } from "./atlas-contract";
import { selectView } from "./atlas-vendor/view.mjs";
import { selectView as selectReviewedView } from "./atlas-vendor/1.1/view.mjs";
import { selectView as selectChainView } from "./atlas-vendor/1.2/view.mjs";
import { selectView as selectDiseaseView } from "./atlas-vendor/1.3/view.mjs";
import { selectView as selectOneHealthView } from "./atlas-vendor/1.4/view.mjs";
import { selectView as selectPanelView } from "./atlas-vendor/1.5/view.mjs";
import type { AtlasOneHealthOptions, AtlasSelectedOneHealth, AtlasDiseaseComposition } from "./atlas-contract";
import type { AtlasReviewedSeries, AtlasSelectedChain } from "./atlas-contract";
function selectResearch(bundle: AtlasSiteBundle, ids: string[]) {
  const { publication_from: from, publication_until: until } = bundle.snapshot;
  if (bundle.contract_version === "1.5.0") return selectPanelView(bundle, from, until, "publication", null, ids);
  if (bundle.contract_version === "1.4.0") return selectOneHealthView(bundle, from, until, "publication", null, ids);
  if (bundle.contract_version === "1.3.0") return { ...selectDiseaseView(bundle, from, until, "publication", null, ids), one_health: null as AtlasSelectedOneHealth | null };
  if (bundle.contract_version === "1.2.0") return { ...selectChainView(bundle, from, until, "publication", null, ids), disease_composition: null as AtlasDiseaseComposition | null, one_health: null as AtlasSelectedOneHealth | null };
  if (bundle.contract_version === "1.1.0") return { ...selectReviewedView(bundle, from, until, "publication", null, ids), reviewed_chains: [] as AtlasSelectedChain[], disease_composition: null as AtlasDiseaseComposition | null, one_health: null as AtlasSelectedOneHealth | null };
  return { ...selectView(bundle, from, until, "publication", null, ids), reviewed_series: [] as AtlasReviewedSeries[], reviewed_chains: [] as AtlasSelectedChain[], numeric_coverage: null, disease_composition: null as AtlasDiseaseComposition | null, one_health: null as AtlasSelectedOneHealth | null };
}
export type Comparison = AtlasSiteBundle["comparisons"][number];
export function createResearch(bundle: AtlasSiteBundle) {
  const assertions = new Map(bundle.assertions.map(a => [a.id, a]));
  const evidence = new Map(bundle.evidence.map(e => [e.id, e]));
  const channels = new Map(bundle.channels.map(c => [c.id, c]));

  let selection: { ids: Set<string>; view: ReturnType<typeof selectResearch> } | undefined;
  function selectedResearch(recordIds: Set<string>) {
    if (!selection || selection.ids.size !== recordIds.size || [...recordIds].some(id => !selection!.ids.has(id))) {
      // Identical report selections share the producer's evidence view across panels.
      selection = { ids: new Set(recordIds), view: selectResearch(bundle, [...recordIds]) };
    }
    return selection.view;
  }

  function reportComparisons(recordIds: Set<string>, reportIds: string[]) {
    const selected = new Set(selectedResearch(recordIds).comparison_ids);
    return bundle.comparisons.filter(c => selected.has(c.id) && c.participant_ids.some(id => reportIds.includes(assertions.get(id)!.record_id)));
  }

  function selectedOneHealth(recordIds: Set<string>, options: AtlasOneHealthOptions = {}): AtlasSelectedOneHealth | null {
    if (!Object.keys(options).length) return selectedResearch(recordIds).one_health;
    if (bundle.contract_version === "1.5.0") return selectPanelView(bundle, bundle.snapshot.publication_from, bundle.snapshot.publication_until, "publication", null, [...recordIds], options).one_health;
    if (bundle.contract_version !== "1.4.0") return null;
    return selectOneHealthView(bundle, bundle.snapshot.publication_from, bundle.snapshot.publication_until, "publication", null, [...recordIds], options).one_health;
  }

  return { bundle, assertions, evidence, channels, selectedResearch, selectedOneHealth, reportComparisons };
}
