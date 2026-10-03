import type { AtlasData, AtlasMap, AtlasMapSnapshot, AtlasSelectionView } from "./atlas-contract";

export type AtlasRecord = Omit<AtlasMapSnapshot["records"][number], "claims">;
export type AtlasTrack = AtlasMap["tracks"][number];
export type AtlasLink = AtlasMapSnapshot["map_links"][number];
export type Support = [string, number][];
export type AtlasAssessment = {
  id: string; track: string; type: string; status: string; from: string; to: string;
  support: Support; basis: string; limit: string;
  updates?: { text: string; support: Support }[];
};
export type DateBasis = "publication" | "capture";
export const linkLabels: Record<string, string> = { movement: "Reported travel", shared_event: "Shared event", hypothesis: "Source hypothesis" };

export function groupGeographicLinks(links: AtlasLink[], records: Map<string, AtlasRecord>) {
  const groups = new Map<string, { link: AtlasLink; date: string }[]>();
  for (const link of links) {
    const endpoints = [link.from, link.to].map(p => [p.lat, p.lon]);
    if (!link.directed) endpoints.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const key = JSON.stringify([link.directed, endpoints]);
    const date = link.support.map(([id]) => records.get(id)!.publication.slice(0, 10)).sort().at(-1)!;
    const group = groups.get(key) ?? [];
    group.push({ link, date });
    groups.set(key, group);
  }
  return [...groups].map(([id, entries]) => ({ id, entries: entries.sort((a, b) => a.date.localeCompare(b.date) || a.link.id.localeCompare(b.link.id)) }));
}

export function supported(support: (string | number)[][], rows: AtlasRecord[] | ReadonlySet<string>) {
  const ids = Array.isArray(rows) ? new Set(rows.map(r => r.id)) : rows;
  return support.every(([id]) => ids.has(String(id)));
}
export function dayNumber(date: string) { return Date.parse(date + "T00:00:00Z") / 86400000; }
export function dayDate(day: number) { return new Date(day * 86400000).toISOString().slice(0, 10); }
export function monthsBefore(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month - months, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 - months, Math.min(day, lastDay))).toISOString().slice(0, 10);
}
const dateFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export function formatDate(date: string) {
  return dateFormatter.format(new Date(date));
}

export function topicIds(selection: string | string[]): string[] { return Array.isArray(selection) ? selection : selection.replace(/^place:/, "").split(",").filter(Boolean); }
export const reportsPerPage = 12;

export function sourceName(source: string) {
  return ({ ECDC_CDTR: "ECDC", WHO_DON: "WHO · DON", FAO_AIV: "FAO · AIV" } as Record<string, string>)[source] ?? source;
}

export function createAtlas<S extends AtlasMap, B extends AtlasData>(snapshot: S, bundle: B) {
  const atlas = { ...snapshot, snapshot: bundle.snapshot };
  const atlasDocuments = new Map(bundle.documents.map(d => [d.id, d]));
  const mappedTracks = atlas.tracks.filter((t): t is AtlasTrack & { lat: number; lon: number } => Number.isFinite(t.lat) && Number.isFinite(t.lon));
  const geographicMemberships = new Map(bundle.location_memberships.map(m => [m.id, m]));
  const geographicRelationships = new Map(bundle.relationships.map(r => [r.id, r]));
  function mapLocations(rows: AtlasRecord[], view: Pick<AtlasSelectionView, "place_ids" | "location_membership_ids" | "relationship_ids">) {
    const ids = new Set(rows.map(r => r.id));
    const placeIds = new Set(view.place_ids);
    const membershipIds = new Set(view.location_membership_ids);
    const relationshipIds = new Set(view.relationship_ids);
    const eligibleTopics = new Set(rows.map(r => r.track));
    const eligibleLinks = new Set(atlas.map_links.filter(link => supported(link.support, ids)).map(link => link.id));
    const groups = new Map<string, typeof bundle.places>();
    for (const place of bundle.places) {
      if (!placeIds.has(place.id)) continue;
      if (!place.topic_ids.length && !place.relationship_ids.some(id => eligibleLinks.has(id))) continue;
      const position = `${place.latitude},${place.longitude}`;
      groups.set(position, [...(groups.get(position) ?? []), place]);
    }
    return [...groups].map(([position, places]) => ({
      id: `point:${position}`, label: [...new Set(places.map(p => p.label))].join(" / "),
      location: [places[0].latitude, places[0].longitude] as [number, number],
      topics: [...new Set(places.flatMap(p => p.topic_ids))].filter(id => eligibleTopics.has(id)),
      records: [...new Set(places.flatMap(p => [
        ...p.location_membership_ids.filter(id => membershipIds.has(id)).map(id => geographicMemberships.get(id)!.record_id),
        ...p.relationship_ids.filter(id => relationshipIds.has(id)).flatMap(id => geographicRelationships.get(id)!.eligibility.record_ids),
      ]))].filter(id => ids.has(id)),
      countries: [...new Set(places.flatMap(p => p.area_codes))],
      links: [...new Set(places.flatMap(p => p.relationship_ids))].filter(id => eligibleLinks.has(id)),
    }));
  }
  function dateBounds(basis: DateBasis) {
    const dates = atlas.records.map(r => r[basis].slice(0, 10)).sort();
    return [dates[0], dates[dates.length - 1]] as const;
  }
  function windowRecords(from: string, until: string, basis: DateBasis) {
    return atlas.records.filter(r => from <= r[basis].slice(0, 10) && r[basis].slice(0, 10) <= until);
  }
  function reportDocuments(rows: AtlasRecord[], basis: DateBasis, topic: string | string[] = "", source: string | string[] = "") {
    const topics = new Set(topicIds(topic));
    const sources = new Set(Array.isArray(source) ? source : source ? [source] : []);
    const documents = new Map<string, AtlasRecord[]>();
    for (const row of rows) {
      if ((topics.size && !topics.has(row.track)) || (sources.size && !sources.has(row.source))) continue;
      const records = documents.get(row.document_id);
      if (records) records.push(row);
      else documents.set(row.document_id, [row]);
    }
    return [...documents.values()].sort((a, b) => atlasDocuments.get(b[0].document_id)![basis].localeCompare(atlasDocuments.get(a[0].document_id)![basis]) || a[0].document_id.localeCompare(b[0].document_id));
  }
  return { atlas, atlasDocuments, mappedTracks, mapLocations, dateBounds, windowRecords, reportDocuments, lookup: new Map(atlas.records.map(r => [r.id, r])), tracks: new Map(atlas.tracks.map(t => [t.id, t])) };
}
