import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createResearch } from '../src/lib/atlas-comparisons';
import { selectorHashes, type AtlasSiteBundle } from '../src/lib/atlas-contract';
import { validateAtlas } from '../scripts/validate-atlas-metrics';

test('Every supported selector matches its reviewed identity', () => {
  for (const [version, hash] of Object.entries(selectorHashes)) {
    const folder = version === '1.0.0' ? '' : version.slice(0,3) + '/';
    assert.equal(createHash('sha256').update(readFileSync(`src/lib/atlas-vendor/${folder}view.mjs`)).digest('hex'), hash);
  }
});
test('One Health preserves evidence eligibility, negative findings and undated observations', {skip:!process.env.ATLAS_ONE_HEALTH_CANDIDATE}, () => {
  const root=process.env.ATLAS_ONE_HEALTH_CANDIDATE!;
  const {bundle}=validateAtlas(root+'/structured',root+'/snapshot.json');
  assert.equal(bundle.contract_version,'1.4.0');
  const research=createResearch(bundle);
  const ids=new Set(bundle.records.map(r=>r.id));
  const all=research.selectedOneHealth(ids)!;
  assert(all.nodes.length>0);assert(all.relations.length>0);
  assert.equal(all.coverage.not_reviewed,1616);
  assert(all.nodes.some(n=>n.finding==='agent_not_detected'));
  assert(!all.relations.some(r=>r.kind==='cross_species_transmission'));
  const animals=research.selectedOneHealth(ids,{domains:['animal']})!;
  assert(animals.nodes.every(n=>n.domain==='animal'));
  const eligible=new Set(animals.nodes.map(n=>n.id));
  assert(animals.relations.every(r=>eligible.has(r.from_node_id)&&eligible.has(r.to_node_id)));
  const dated=research.selectedOneHealth(ids,{observation_from:'2026-07-01',observation_until:'2026-07-31'})!;
  assert(dated.undated_nodes.length>0);
  const visible=new Set(dated.nodes.map(n=>n.id));
  assert(dated.undated_nodes.every(n=>!visible.has(n.id)));
  assert(dated.relations.every(r=>visible.has(r.from_node_id)&&visible.has(r.to_node_id)));
  const relation=all.relations[0];
  const removed=new Set(ids);removed.delete(relation.eligibility.record_ids[0]);
  assert(!research.selectedOneHealth(removed)!.relations.some(r=>r.id===relation.id));
  const legacy=JSON.parse(readFileSync('.cache/atlas-fixture/atlas-site.json','utf8')) as AtlasSiteBundle;
  assert.equal(createResearch(legacy).selectedOneHealth(new Set(legacy.records.map(r=>r.id))),null);
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
