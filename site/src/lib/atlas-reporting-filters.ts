import type { AtlasData } from "./atlas-contract";
import type { AtlasRecord } from "./atlas";

export type ReportingFilters = { places: string[]; diseases: string[]; topics: string[]; sources: string[]; includeContext: boolean };
type Choice = { value: string; label: string; count: number; searchText?: string };

export function reportingFacets(bundle: AtlasData, rows: AtlasRecord[], filters: ReportingFilters) {
  const scope = new Set(rows.map(row => row.id));
  const supported = (eligibility: { record_ids: string[] }) => eligibility.record_ids.every(id => scope.has(id));
  const places = new Map<string, Set<string>>();
  for (const membership of bundle.location_memberships) {
    if (!scope.has(membership.record_id) || !supported(membership.eligibility) || membership.role === "context" && !filters.includeContext) continue;
    const codes = places.get(membership.record_id) ?? new Set<string>();
    codes.add(membership.area_code);
    places.set(membership.record_id, codes);
  }
  const reviews = new Map(bundle.disease_reviews.map(review => [review.record_id, review]));
  const classifications = new Map(rows.map(row => {
    const review = reviews.get(row.id);
    const diseases = !review || !supported(review.eligibility) || review.kind === "unresolved" ? ["unclassified"]
      : review.kind === "not_disease_specific" ? ["not_disease_specific"] : review.disease_ids;
    return [row.id, { places: [...(places.get(row.id) ?? ["unspecified"])], diseases }] as const;
  }));
  const matches = (choices: readonly string[], selection: string[]) => !selection.length || choices.some(id => selection.includes(id));
  const placeCounts = new Map<string, number>(), diseaseCounts = new Map<string, number>();
  const selected = rows.filter(row => {
    if (filters.topics.length && !filters.topics.includes(row.track) || filters.sources.length && !filters.sources.includes(row.source)) return false;
    const entry = classifications.get(row.id)!;
    const placeMatch = matches(entry.places, filters.places), diseaseMatch = matches(entry.diseases, filters.diseases);
    if (diseaseMatch) for (const id of entry.places) placeCounts.set(id, (placeCounts.get(id) ?? 0) + 1);
    if (placeMatch) for (const id of new Set(entry.diseases)) diseaseCounts.set(id, (diseaseCounts.get(id) ?? 0) + 1);
    return placeMatch && diseaseMatch;
  });
  const choices = (items: { value: string; label: string; searchText?: string }[], counts: Map<string, number>): Choice[] =>
    items.sort((a, b) => a.label.localeCompare(b.label)).map(item => ({ ...item, count: counts.get(item.value) ?? 0 }));
  return {
    rows: selected,
    places: [...choices(bundle.areas.map(area => ({ value: area.code, label: area.label, searchText: area.code })), placeCounts),
      { value: "unspecified", label: "Location unspecified", count: placeCounts.get("unspecified") ?? 0 }],
    diseases: [...choices(bundle.diseases.map(disease => ({ value: disease.id, label: disease.label })), diseaseCounts),
      { value: "not_disease_specific", label: "Not disease-specific", count: diseaseCounts.get("not_disease_specific") ?? 0 },
      { value: "unclassified", label: "Unclassified disease", count: diseaseCounts.get("unclassified") ?? 0 }],
  };
}
