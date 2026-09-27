import type { AtlasSiteBundle } from "./atlas-contract";
import { selectView } from "./atlas-vendor/view.mjs";
import { selectView as selectReviewedView } from "./atlas-vendor/1.1/view.mjs";
import { selectView as selectChainView } from "./atlas-vendor/1.2/view.mjs";
import type { AtlasReviewedSeries, AtlasSelectedChain } from "./atlas-contract";
function selectResearch(bundle: AtlasSiteBundle, ids: string[]) {
  const { publication_from: from, publication_until: until } = bundle.snapshot;
  if (bundle.contract_version === "1.2.0") return selectChainView(bundle, from, until, "publication", null, ids);
  if (bundle.contract_version === "1.1.0") return { ...selectReviewedView(bundle, from, until, "publication", null, ids), reviewed_chains: [] as AtlasSelectedChain[] };
  return { ...selectView(bundle, from, until, "publication", null, ids), reviewed_series: [] as AtlasReviewedSeries[], reviewed_chains: [] as AtlasSelectedChain[], numeric_coverage: null };
}
export type Comparison = AtlasSiteBundle["comparisons"][number];
export function createResearch(bundle: AtlasSiteBundle) {
  const assertions = new Map(bundle.assertions.map(a => [a.id, a]));
  const evidence = new Map(bundle.evidence.map(e => [e.id, e]));
  const channels = new Map(bundle.channels.map(c => [c.id, c]));

  const views = new WeakMap<Set<string>, ReturnType<typeof selectResearch>>();
  function selectedResearch(recordIds: Set<string>) {
    let view = views.get(recordIds);
    if (!view) {
      // The record selection carries the interface's date, topic and source filters.
      view = selectResearch(bundle, [...recordIds]);
      views.set(recordIds, view);
    }
    return view;
  }

  function reportComparisons(recordIds: Set<string>, reportIds: string[]) {
    const selected = new Set(selectedResearch(recordIds).comparison_ids);
    return bundle.comparisons.filter(c => selected.has(c.id) && c.participant_ids.some(id => reportIds.includes(assertions.get(id)!.record_id)));
  }

  return { bundle, assertions, evidence, channels, selectedResearch, reportComparisons };
}
