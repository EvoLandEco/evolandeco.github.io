import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createResearch } from '../src/lib/atlas-comparisons';
import { selectorHashes } from '../scripts/atlas-selector-pins';

test('Archived and current validation selectors match their reviewed identities', () => {
  for (const [version, hash] of Object.entries(selectorHashes)) {
    const folder = version === '1.0.0' ? '' : version.slice(0,3) + '/';
    const file = version === '1.8.0' ? 'browser/0.3/site_view.js' : version === '1.7.0' ? 'browser/0.2/site_view.js' : version === '1.6.0' ? 'browser/site_view.js' : `${folder}view.mjs`;
    assert.equal(createHash('sha256').update(readFileSync(`src/lib/atlas-vendor/${file}`)).digest('hex'), hash);
  }
});
test('Equal report selections reuse evidence while changed selections and domain filters remain distinct', async () => {
  const { healthPanelsFixture } = await import('./atlas-health-panels-fixture');
  const bundle = healthPanelsFixture();
  const research = createResearch(bundle);
  const ids = new Set(bundle.records.map(r => r.id));
  const view = research.selectedResearch(ids);
  assert.equal(research.selectedResearch(new Set([...ids].reverse())), view);
  assert.equal(research.selectedOneHealth(new Set(ids)), view.one_health);
  const animals = research.selectedOneHealth(ids, { domains: ['animal'] })!;
  assert(animals.nodes.every(n => n.domain === 'animal'));
  ids.delete(bundle.one_health_nodes[0].record_id);
  const filtered = research.selectedResearch(ids);
  assert.notEqual(filtered, view);
  assert(!filtered.one_health!.nodes.some(n => n.id === bundle.one_health_nodes[0].id));
});
