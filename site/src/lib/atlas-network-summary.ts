import { supported, type AtlasLink, type AtlasRecord, type DateBasis } from './atlas';
import type { AtlasData } from './atlas-contract';
import { countryContinent } from '../components/magicui/globe-network-regions';

export const networkLayers = [
  { id: 'movement_directed', label: 'Reported travel · directed' },
  { id: 'movement_unspecified', label: 'Reported travel · direction unspecified' },
  { id: 'shared_event', label: 'Shared events' },
  { id: 'hypothesis', label: 'Source hypotheses' },
] as const;
export type NetworkLayer = typeof networkLayers[number]['id'];
export const networkLayer = (link: AtlasLink): NetworkLayer => link.type === 'movement'
  ? link.directed ? 'movement_directed' : 'movement_unspecified' : link.type;

type Geography = Pick<AtlasData, 'areas' | 'documents' | 'channels' | 'organizations' | 'location_memberships'>;
type Input = {
  links: AtlasLink[]; rows: AtlasRecord[]; bundle: Geography; layer: NetworkLayer;
  countriesForLink: (link: AtlasLink) => string[][];
  membershipIds: ReadonlySet<string>; includeContext: boolean; basis: DateBasis; window: readonly [string, string];
};

export function networkSummary({ links, rows, bundle, layer, countriesForLink, membershipIds, includeContext, basis, window }: Input) {
  const records = new Map(rows.map(row => [row.id, row]));
  const recordIds = new Set(records.keys());
  const documents = new Map(bundle.documents.map(document => [document.id, document]));
  const channels = new Map(bundle.channels.map(channel => [channel.id, channel]));
  const areas = new Map(bundle.areas.filter(area => area.code_system === 'ISO_3166_1_alpha_2').map(area => [area.code, area.label]));
  const eligible = [...new Map(links.filter(link => link.support.length && supported(link.support, recordIds)).map(link => [link.id, link])).values()];
  const edges = eligible.filter(link => networkLayer(link) === layer);
  function evidence(items: AtlasLink[]) {
    const ids = [...new Set(items.flatMap(link => link.support.map(([id]) => id)))];
    const docs = [...new Set(ids.map(id => records.get(id)!.document_id))];
    const sources = [...new Set(docs.map(id => documents.get(id)!.channel_id))];
    const organizations = [...new Set(sources.map(id => channels.get(id)!.organization_id))];
    return { links: items, records: ids, documents: docs, channels: sources, organizations };
  }
  const resolved = edges.map(link => {
    const endpoints = countriesForLink(link).map(codes => [...new Set(codes)]);
    const countries = endpoints.length === 2 && endpoints.every(codes => codes.length === 1 && areas.has(codes[0]))
      ? [endpoints[0][0], endpoints[1][0]] as [string, string] : null;
    return { link, countries, mentioned: [...new Set(endpoints.flat())].filter(code => areas.has(code)) };
  });
  const countryEdges = new Map<string, AtlasLink[]>();
  const neighbors = new Map<string, Set<string>>();
  const pairEdges = new Map<string, { countries: [string, string]; links: AtlasLink[] }>();
  const cellEdges = new Map<string, { regions: [string, string]; links: AtlasLink[] }>();
  const domestic: AtlasLink[] = [];
  for (const { link, countries } of resolved) {
    if (!countries) continue;
    const [from, to] = countries;
    for (const code of new Set(countries)) {
      countryEdges.set(code, [...(countryEdges.get(code) ?? []), link]);
      if (!neighbors.has(code)) neighbors.set(code, new Set());
    }
    if (from === to) domestic.push(link);
    else {
      neighbors.get(from)!.add(to); neighbors.get(to)!.add(from);
      const codes: [string, string] = link.directed ? countries : [...countries].sort() as [string, string];
      const key = JSON.stringify([link.type, link.directed, codes]);
      const pair = pairEdges.get(key) ?? { countries: codes, links: [] };
      pair.links.push(link); pairEdges.set(key, pair);
    }
    const regions = countries.map(code => countryContinent.get(code)?.id ?? 'unmapped') as [string, string];
    if (!link.directed) regions.sort();
    const key = JSON.stringify(regions);
    const cell = cellEdges.get(key) ?? { regions, links: [] };
    cell.links.push(link); cellEdges.set(key, cell);
  }
  const countries = [...countryEdges].map(([code, items]) => ({
    code, label: areas.get(code)!, neighbors: neighbors.get(code)!, ...evidence(items),
    incoming: resolved.filter(edge => edge.link.directed && edge.countries?.[1] === code && edge.countries[0] !== code).length,
    outgoing: resolved.filter(edge => edge.link.directed && edge.countries?.[0] === code && edge.countries[1] !== code).length,
  })).sort((a, b) => b.neighbors.size - a.neighbors.size || b.links.length - a.links.length || a.label.localeCompare(b.label));
  const components: string[][] = [];
  const visited = new Set<string>();
  for (const country of countries) {
    if (visited.has(country.code)) continue;
    const component = [country.code]; visited.add(country.code);
    for (let i = 0; i < component.length; i++) for (const next of neighbors.get(component[i])!) {
      if (!visited.has(next)) { visited.add(next); component.push(next); }
    }
    components.push(component.sort());
  }
  components.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  const mentioned = new Map<string, Set<string>>();
  for (const edge of resolved) for (const code of edge.mentioned) {
    const ids = mentioned.get(code) ?? new Set<string>();
    for (const [id] of edge.link.support) ids.add(id);
    mentioned.set(code, ids);
  }
  for (const membership of bundle.location_memberships) {
    if (!membershipIds.has(membership.id) || !recordIds.has(membership.record_id) || !areas.has(membership.area_code)
      || !membership.eligibility.record_ids.every(id => recordIds.has(id)) || membership.role === 'context' && !includeContext) continue;
    const ids = mentioned.get(membership.area_code) ?? new Set<string>();
    ids.add(membership.record_id); mentioned.set(membership.area_code, ids);
  }
  const unlinked = [...mentioned].filter(([code]) => !countryEdges.has(code)).map(([code, ids]) => ({ code, label: areas.get(code)!, records: [...ids] })).sort((a, b) => a.label.localeCompare(b.label));
  const totals = evidence(edges);
  const sources = [...new Set(totals.channels)].map(id => {
    const ids = totals.documents.filter(document => documents.get(document)!.channel_id === id);
    const related = edges.filter(link => link.support.some(([record]) => ids.includes(records.get(record)!.document_id)));
    return { id, label: channels.get(id)!.name, ...evidence(related), sourceDocuments: ids.length };
  }).sort((a, b) => b.sourceDocuments - a.sourceDocuments || a.label.localeCompare(b.label));
  const months = new Map<string, AtlasLink[]>();
  const untilMonth = window[1].slice(0, 7);
  for (let month = window[0].slice(0, 7); month <= untilMonth;) {
    months.set(month, []);
    const [year, number] = month.split('-').map(Number);
    month = `${number === 12 ? year + 1 : year}-${String(number === 12 ? 1 : number + 1).padStart(2, '0')}`;
  }
  const undated: AtlasLink[] = [];
  for (const edge of edges) {
    const dates = [...new Set(edge.support.map(([id]) => records.get(id)![basis]?.slice(0, 10)))];
    if (dates.some(date => !date || !/^\d{4}-\d{2}-\d{2}$/.test(date))) { undated.push(edge); continue; }
    const month = dates.sort().at(-1)!.slice(0, 7);
    const items = months.get(month);
    if (items) items.push(edge);
  }
  const chronology = [...months].map(([month, items]) => {
    const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
    return { month, partial: window[0] > `${month}-01` || window[1] < last, ...evidence(items),
      selectedDocuments: new Set(rows.filter(row => row[basis]?.startsWith(month)).map(row => row.document_id)).size };
  });
  return { ...totals, eligible, areas, countries, components, unlinked, sources, chronology, undated,
    selectedDocuments: new Set(rows.map(row => row.document_id)).size,
    pairs: [...pairEdges].map(([id, pair]) => ({ id, countries: pair.countries, ...evidence(pair.links) })).sort((a, b) => b.links.length - a.links.length || a.id.localeCompare(b.id)),
    cells: [...cellEdges].map(([id, cell]) => ({ id, regions: cell.regions, ...evidence(cell.links) })),
    domestic: evidence(domestic), unresolved: evidence(resolved.filter(edge => !edge.countries).map(edge => edge.link)),
  };
}
export type NetworkSummary = ReturnType<typeof networkSummary>;
