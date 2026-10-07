import type { AtlasData, AtlasMap } from "./atlas-contract";
import { sourceName as shortSourceName } from "./atlas";
import type { AtlasLink, AtlasRecord } from "./atlas";
export const logos: Record<string, string> = {
  who: "who.png", ecdc: "ecdc.svg", efsa: "efsa.svg", fao: "fao.svg",
  ncdc: "ncdc.svg", paho: "paho.ico", rivm: "rivm.svg", ukhsa: "ukhsa.svg",
};

export const sourceLogos: Record<string, string> = {
  who_don: logos.who, who_afro: logos.who, who_sitreps: logos.who,
  ecdc_cdtr: logos.ecdc, efsa: logos.efsa, fao_aiv: logos.fao,
  ncdc_sitreps: logos.ncdc, paho_alerts: logos.paho, rivm: logos.rivm,
  ukhsa_monitoring: logos.ukhsa,
  un_geneva_news: "un.svg", cbs_health: "cbs.svg", irk_news: "irk.svg",
  france_spf: "spf.svg", rki_bulletin: "rki.png",
  china_cdc: "china-cdc.svg", us_cdc_mmwr: "cdc.ico",
};

export function createIdentities(bundle: AtlasData, atlas: AtlasMap) {
  const organizations = new Map(bundle.organizations.map(o => [o.id, o]));
  const reportOrganizations = Object.fromEntries(bundle.channels.map(channel => [channel.snapshot_source, {
    name: organizations.get(channel.organization_id)!.name, label: logos[channel.organization_id] ? shortSourceName(channel.snapshot_source) : channel.name, logo: logos[channel.organization_id] ?? sourceLogos[channel.acquisition_source],
  }]));
  const places = new Map(bundle.places.map(p => [p.id, p]));
  const relationships = new Map(bundle.relationships.map(r => [r.id, r]));
  const recordsById = new Map(bundle.records.map(r => [r.id, r]));
  const memberships = new Map(bundle.location_memberships.map(m => [m.id, m]));
  const trackCountries = Object.fromEntries(bundle.topics.map(topic => [topic.id,
    [...new Set(topic.place_ids.flatMap(id => places.get(id)!.area_codes))],
  ]));
  const contextCountries = new Map<string, string[]>(atlas.map_links.flatMap(link => {
    const relationship = relationships.get(link.id)!;
    return [link.from, link.to].flatMap((endpoint, i) => endpoint.track ? [] : [[
      `context:${link.id}:${endpoint.label}`,
      places.get(i === 0 ? relationship.from_place_id! : relationship.to_place_id!)!.area_codes,
    ] as const]);
  }));

  function countriesForLocations(ids: string[]) {
    return [...new Set(ids.flatMap(id => trackCountries[id] ?? contextCountries.get(id) ?? []))];
  }

  function countriesForLink(link: AtlasLink) {
    const relationship = relationships.get(link.id)!;
    return [relationship.from_place_id!, relationship.to_place_id!].map(id => places.get(id)!.area_codes);
  }

  function countriesForReports(records: AtlasRecord[]) {
    return [...new Set(records.flatMap(record => recordsById.get(record.id)!.location_membership_ids
      .map(id => memberships.get(id)!.area_code)))];
  }

  function sourceName(source: string) { return reportOrganizations[source].label; }

  return { sourceName, reportOrganizations, trackCountries, countriesForLocations, countriesForLink, countriesForReports };
}
