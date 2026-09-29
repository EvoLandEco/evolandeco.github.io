import { z } from 'zod';
import { atlasOrigin, releaseRoot, verifiedBytes, type AtlasRelease } from './atlas-release';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const asset = z.object({ bytes: z.number().int().positive(), sha256: digest, relative_path: z.string() });
const transportSchema = z.object({
  transport_version: z.literal('0.1.0'), hash_basis: z.literal('sha256_file_bytes'),
  publication_authorized: z.literal(false), analysis_id: digest, site_release_id: digest,
  site: asset, map: asset, selector: asset, analysis: asset, schema: asset,
});
const analysisSchema = z.object({
  contract_version: z.literal('0.2.0'), analysis_id: digest,
  release_status: z.literal('research_preview'), publication_authorized: z.literal(false),
  method: z.object({ id: z.literal('reporting-network-3') }), inputs: z.object({ site_sha256: digest }),
  uncertainty: z.object({ status: z.literal('not_estimated'), lower: z.null(), upper: z.null(), reason: z.string().min(1) }),
  unavailable: z.object({ collection_adjusted: z.string().min(1), surveillance_adjusted: z.string().min(1), complete_episode_ranking: z.string().min(1) }),
  units: z.array(z.object({
    id: z.string().min(1), record_ids: z.array(z.string().min(1)).min(1),
    identity_status: z.enum(['unreviewed', 'source_checked_repeat_report_group', 'source_checked_identity_unresolved']),
    movement_category: z.enum(['living_travellers', 'product_shipments', 'human_remains', 'vessel_only', 'not_applicable', 'unresolved']),
    granularity: z.enum(['individual_journey', 'aggregate_travellers', 'shared_episode', 'product_consignment', 'human_remains_transfer', 'vessel_voyage', 'unresolved']),
    directed: z.boolean(), from_country: z.string().regex(/^[A-Z]{2}$/), to_country: z.string().regex(/^[A-Z]{2}$/),
  })),
  repeat_report_reviews: z.array(z.object({
    id: z.string().min(1), status: z.literal('source_checked_draft'),
    relationship_ids: z.array(z.string().min(1)).min(2), basis: z.string().min(1), source_lineage: z.string().min(1),
  })),
});
export type NetworkAnalysis = z.infer<typeof analysisSchema>;

export function validateNetworkTransport(value: unknown, release: AtlasRelease) {
  const transport = transportSchema.parse(value);
  const base = `releases/${release.export_id}`;
  if (transport.site_release_id !== release.export_id || transport.selector.sha256 !== release.selector_sha256 || transport.selector.relative_path !== `${base}/view.mjs`)
    throw new Error('Network analysis release binding mismatch');
  for (const [key, name] of [['site', 'atlas-site.json'], ['map', 'map.json']] as const) {
    if (transport[key].sha256 !== release.assets[name].sha256 || transport[key].bytes !== release.assets[name].bytes || transport[key].relative_path !== `${base}/${name}`)
      throw new Error('Network analysis dataset binding mismatch');
  }
  if (transport.analysis.relative_path !== `network-analysis/${transport.analysis_id}/network-analysis.json` || transport.schema.relative_path !== `network-analysis/${transport.analysis_id}/network-analysis.schema.json` || transport.schema.sha256 !== 'aac5090e1b7aa1e743791a78b8902e077709bcaa40b797d95fd5c13e78f59a4e')
    throw new Error('Network analysis contract requires review');
  return transport;
}

export function parseNetworkAnalysis(value: unknown, transport: ReturnType<typeof validateNetworkTransport>) {
  const analysis = analysisSchema.parse(value);
  if (analysis.analysis_id !== transport.analysis_id || analysis.inputs.site_sha256 !== transport.site.sha256)
    throw new Error('Network analysis input mismatch');
  const units = new Set(analysis.units.map(unit => unit.id));
  const grouped = new Set<string>();
  if (new Set(analysis.repeat_report_reviews.map(group => group.id)).size !== analysis.repeat_report_reviews.length)
    throw new Error('Duplicate network review groups');
  if (units.size !== analysis.units.length) throw new Error('Duplicate network analysis units');
  for (const group of analysis.repeat_report_reviews) for (const id of group.relationship_ids) {
    if (!units.has(id) || grouped.has(id)) throw new Error('Invalid network review membership');
    grouped.add(id);
  }
  return analysis;
}

export async function fetchNetworkAnalysis(release: AtlasRelease, signal: AbortSignal) {
  const descriptor = release.assets['network-transport.json'];
  if (!descriptor) throw new Error('No network analysis attached to this release');
  const bytes = await verifiedBytes(await fetch(`${releaseRoot(release)}/network-transport.json`, { signal }), descriptor);
  const transport = validateNetworkTransport(JSON.parse(new TextDecoder().decode(bytes)), release);
  const analysisBytes = await verifiedBytes(await fetch(`${atlasOrigin}/${transport.analysis.relative_path}`, { signal }), transport.analysis);
  signal.throwIfAborted();
  return parseNetworkAnalysis(JSON.parse(new TextDecoder().decode(analysisBytes)), transport);
}

export function selectNetworkReview(analysis: NetworkAnalysis, linkIds: string[], recordIds: ReadonlySet<string>) {
  const selected = new Set(linkIds);
  const units = analysis.units.filter(unit => selected.has(unit.id) && unit.record_ids.every(id => recordIds.has(id)));
  const eligible = new Set(units.map(unit => unit.id));
  const groups = analysis.repeat_report_reviews.filter(group => group.relationship_ids.every(id => eligible.has(id)));
  const reviewed = groups.reduce((sum, group) => sum + group.relationship_ids.length, 0);
  const assessed = units.filter(unit => unit.identity_status !== 'unreviewed').length;
  const unresolved = units.filter(unit => unit.identity_status === 'source_checked_identity_unresolved').length;
  const partialUnits = units.length - reviewed + groups.length;
  return { units, groups, reviewed, assessed, unresolved, partialUnits };
}
