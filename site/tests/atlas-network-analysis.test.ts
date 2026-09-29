import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateNetworkTransport, parseNetworkAnalysis, selectNetworkReview } from '../src/lib/atlas-network-analysis';
import { releaseSchema, verifiedBytes } from '../src/lib/atlas-release';

const hash = 'a'.repeat(64), id = 'b'.repeat(64);
const asset = { sha256: hash, bytes: 1 };
const release = releaseSchema.parse({ version: 1, export_id: hash, published_at: '2026-09-29T00:00:00Z', cycle: null, mode: 'initial', contract_version: '1.5.0', selector_sha256: hash, assets: { 'atlas-site.json': asset, 'map.json': asset, 'metrics.json': asset } });
const value = {
  transport_version: '0.1.0', hash_basis: 'sha256_file_bytes', publication_authorized: false, analysis_id: id, site_release_id: hash,
  site: { ...asset, relative_path: `releases/${hash}/atlas-site.json` }, map: { ...asset, relative_path: `releases/${hash}/map.json` },
  selector: { ...asset, relative_path: `releases/${hash}/view.mjs` }, analysis: { ...asset, relative_path: `network-analysis/${id}/network-analysis.json` },
  schema: { ...asset, sha256: 'aac5090e1b7aa1e743791a78b8902e077709bcaa40b797d95fd5c13e78f59a4e', relative_path: `network-analysis/${id}/network-analysis.schema.json` },
};

test('Network evidence reader rejects wrong release, paths, integrity and review membership', async () => {
  const transport = validateNetworkTransport(value, release);
  for (const invalid of [ { ...value, site_release_id: id }, { ...value, site: { ...value.site, sha256: id } }, { ...value, analysis: { ...value.analysis, relative_path: 'https://example.com/analysis.json' } } ])
    assert.throws(() => validateNetworkTransport(invalid, release));
  await assert.rejects(verifiedBytes(new Response('x'), asset), /checksum/);
  const analysis = {
    contract_version: '0.2.0', analysis_id: id, release_status: 'research_preview', publication_authorized: false,
    method: { id: 'reporting-network-3' }, inputs: { site_sha256: hash }, uncertainty: { status: 'not_estimated', lower: null, upper: null, reason: 'Unknown ascertainment' },
    unavailable: { collection_adjusted: 'Unknown frame', surveillance_adjusted: 'Unknown effort', complete_episode_ranking: 'Partial review' },
    units: ['one', 'two'].map((id, i) => ({ id, record_ids: [`r${i + 1}`], identity_status: 'source_checked_repeat_report_group', movement_category: 'living_travellers', granularity: 'individual_journey', directed: true, from_country: 'SN', to_country: 'IT' })),
    repeat_report_reviews: [{ id: 'g', status: 'source_checked_draft', relationship_ids: ['one', 'two'], basis: 'Same event', source_lineage: 'Same source' }],
  };
  const parsed = parseNetworkAnalysis(analysis, transport);
  assert.equal(parsed.repeat_report_reviews.length, 1);
  assert.equal(selectNetworkReview(parsed, ['one', 'two', 'two'], new Set(['r1', 'r2'])).reviewed, 2);
  const partial = selectNetworkReview(parsed, ['one'], new Set(['r1', 'r2']));
  assert.equal(partial.units.length, 1);
  assert.equal(partial.groups.length, 0);
  assert.equal(partial.reviewed, 0);
  assert.equal(partial.partialUnits, 1);
  const missingSupport = selectNetworkReview(parsed, ['one', 'two'], new Set(['r1']));
  assert.equal(missingSupport.units.length, 1);
  assert.equal(missingSupport.groups.length, 0);
  assert.equal(selectNetworkReview(parsed, ['one', 'two'], new Set(['r1', 'r2'])).partialUnits, 1);
  assert.equal(selectNetworkReview(parsed, [], new Set(['r1', 'r2'])).units.length, 0);
  assert.throws(() => parseNetworkAnalysis({ ...analysis, inputs: { site_sha256: id } }, transport));
  assert.throws(() => parseNetworkAnalysis({ ...analysis, units: [analysis.units[0]] }, transport));
  assert.throws(() => parseNetworkAnalysis({ ...analysis, repeat_report_reviews: [...analysis.repeat_report_reviews, ...analysis.repeat_report_reviews] }, transport));
});
