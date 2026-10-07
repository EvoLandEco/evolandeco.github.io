import type { AtlasData, AtlasSiteBundle, AtlasReportAssessment } from "./atlas-contract";
import type { AtlasBrowserSelector } from "./atlas-browser";
import { selectView as selectAssessedView } from "./atlas-vendor/browser/0.3/site_view.js";
import type { AtlasOneHealthOptions, AtlasSelectedOneHealth } from "./atlas-contract";
function selectResearch(bundle: AtlasSiteBundle, ids: string[], options: AtlasOneHealthOptions = {}) {
  const { publication_from: from, publication_until: until } = bundle.snapshot;
  return selectAssessedView(bundle, from, until, "publication", null, ids, options);
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
  function selectedResearch(recordIds: Set<string>): ReturnType<typeof select> & { report_assessments?: AtlasReportAssessment[] } {
    if (!selection || selection.ids.size !== recordIds.size || [...recordIds].some(id => !selection!.ids.has(id))) {
      // Identical report selections share the producer's evidence view across panels.
      selection = { ids: new Set(recordIds), view: select([...recordIds]) };
    }
    return selection.view;
  }

  function reportAssessments(recordIds: Set<string>, reportIds: string[]): AtlasReportAssessment[] {
    const view = selectedResearch(recordIds);
    return (view.report_assessments ?? []).filter(row => reportIds.includes(row.record_id));
  }

  function reportComparisons(recordIds: Set<string>, reportIds: string[]) {
    const selected = new Set(selectedResearch(recordIds).comparison_ids);
    return bundle.comparisons.filter(c => selected.has(c.id) && c.participant_ids.some(id => reportIds.includes(assertions.get(id)!.record_id)));
  }

  function selectedOneHealth(recordIds: Set<string>, options: AtlasOneHealthOptions = {}): AtlasSelectedOneHealth | null {
    if (!Object.keys(options).length) return selectedResearch(recordIds).one_health;
    return select([...recordIds], options).one_health;
  }

  return { bundle, assertions, channels, selectedResearch, selectedOneHealth, reportComparisons, reportAssessments };
}
