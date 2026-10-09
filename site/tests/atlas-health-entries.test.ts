import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareHealthEvidence, healthOverviewEvidence, healthEntryIndex, healthPanelForEntry, matchesHealthEntry } from '../src/lib/atlas-health-entries';
import { healthPanelsFixture } from './atlas-health-panels-fixture';
import { selectView } from '../src/lib/atlas-vendor/browser/0.3/site_view.js';

test('Entry availability and filters retain eligible dated, undated and independent evidence',()=>{
 const b=healthPanelsFixture(),view=selectView(b,'2020-01-01','2030-01-01').one_health!;
 const index=healthEntryIndex(view),entry=index.get(b.one_health_nodes[0].record_id)!;
 assert.deepEqual(entry.counts,{network:1,evidence:0,timeline:7,sampling:2,environment:2});
 assert.equal(entry.dated,true);assert.equal(entry.fraction,true);
 const independent=index.get(b.one_health_contexts[1].record_id)!;
 assert.equal(independent.counts.network,0);assert.equal(independent.counts.environment,1);
 assert(matchesHealthEntry(independent,['view:environment']));
 assert(!matchesHealthEntry(independent,['view:environment','domain:human']));
 assert(matchesHealthEntry(entry,['view:evidence','view:sampling','domain:human','domain:animal','feature:dated','feature:fraction']));
 assert(!matchesHealthEntry(entry,['feature:dated','feature:negative']));
 assert(healthPanelForEntry({record_id:'another',node_id:'linked'},'entry',new Set(['linked'])));
 assert(!healthPanelForEntry({record_id:'another'},'entry',new Set(['linked'])));
 const empty=healthEntryIndex({...view,nodes:[],undated_nodes:[],relations:[],timings:[],undated_timings:[],reporting_cutoffs:[],sampling_assessments:[],undated_sampling_assessments:[],contexts:[],undated_contexts:[]});
 assert.equal(empty.size,0);
});


test('Overview evidence order counts distinct support without promoting hypotheses or negative findings',()=>{
 const b=healthPanelsFixture(),view=selectView(b,'2020-01-01','2030-01-01').one_health!;
 const node=[...view.nodes,...view.undated_nodes][0];
 const relation:typeof view.relations[number]={...node,id:'reported',key:'reported',label:'Test relation',scope:'Test scope',reason:'Test support',kind:'exposure',basis:'source_reported',evidence_types:['human_testing','epidemiological_investigation'],directed:false,direction_basis:'not_reported',source_certainty:{value:null,status:'not_reported'},reviewed_at:'2026-09-29',reviewed_by:'Test',review_state:'source_checked_draft',from_node_id:node.id,to_node_id:node.id,source_assertion_id:'test-oh-assertion',contested:false,comparison_ids:[]};
 const evidence=healthOverviewEvidence({...view,relations:[relation,{...relation,id:'second',evidence_types:['human_testing']},{...relation,id:'hypothesis',basis:'source_hypothesis',record_ids:['hypothesis']},{...relation,id:'contested',contested:true,record_ids:['contested']}]});
 const row=evidence.get(node.record_id)!;
 assert.deepEqual(row.rank,[2,2,1,1,1]);
 assert.equal(evidence.get('hypothesis')!.hypotheses,1);
 assert.equal(evidence.get('contested')!.contested,1);
 assert.deepEqual(evidence.get('hypothesis')!.rank,[0,0,0,0,0]);
 assert.deepEqual(evidence.get('contested')!.rank,[0,0,0,0,0]);
 const negative=healthOverviewEvidence({...view,nodes:[],undated_nodes:[{...node,finding:'agent_not_detected'}]});
 assert.deepEqual(negative.get(node.record_id)!.rank,healthOverviewEvidence(view).get(node.record_id)!.rank);
 assert(compareHealthEvidence(row.rank,evidence.get('hypothesis')!.rank)<0);
 assert(compareHealthEvidence([1,1,1,1,1],[0,9,9,9,9])<0);
 assert(compareHealthEvidence([1,2,1,1,1],[1,1,9,9,9])<0);
 assert.equal(compareHealthEvidence(undefined,[0,0,0,0,0]),0);
});

test('Entry indexing retains connected support, own statements and independent context', () => {
 const view = selectView(healthPanelsFixture(), '2020-01-01', '2030-01-01').one_health!;
 const original = [...view.nodes, ...view.undated_nodes][0];
 const nodes = Array.from({length: 8}, (_, i) => ({...original, id: `node-${i}`, record_id: `report-${Math.floor(i / 2)}`, domain: (['human', 'animal', 'environment', 'food'] as const)[i % 4], finding: i === 5 ? 'agent_not_detected' as const : original.finding}));
 const edge: typeof view.relations[number] = {...original, id: 'edge', key: 'edge', label: 'Test relationship', scope: 'Test scope', reason: 'Test support', kind: 'exposure', basis: 'source_reported', evidence_types: [], directed: false, direction_basis: 'not_reported', source_certainty: {value: null, status: 'not_reported'}, reviewed_at: '2026-09-29', reviewed_by: 'Test', review_state: 'source_checked_draft', from_node_id: nodes[0].id, to_node_id: nodes[2].id, source_assertion_id: 'test-oh-assertion', contested: false, comparison_ids: []};
 const sample = {...view.sampling_assessments[0], record_id: 'sample-report', node_id: nodes[5].id};
 const timing = {...view.timings[0], record_id: 'time-report', node_id: nodes[2].id};
 const context = {...view.contexts[0], record_id: 'context-report', node_ids: [nodes[0].id], kind: 'source_hypothesis' as const};
 for (const relations of [[], [edge], [edge, {...edge, id: 'hypothesis', from_node_id: nodes[2].id, to_node_id: nodes[5].id, basis: 'source_hypothesis' as const}, {...edge, id: 'self', from_node_id: nodes[7].id, to_node_id: nodes[7].id}]]) {
  const selected = {...view, nodes: nodes.slice(0, 4), undated_nodes: nodes.slice(4), relations, timings: [timing], undated_timings: [{...timing, id: 'undated', record_id: 'report-3', node_id: nodes[1].id}], reporting_cutoffs: [{...view.reporting_cutoffs[0], record_id: 'cutoff-only', node_id: nodes[7].id}], sampling_assessments: [sample], undated_sampling_assessments: [], contexts: [context], undated_contexts: []};
  const index = healthEntryIndex(selected);
  const all = [...selected.nodes, ...selected.undated_nodes];
  const timings = [...selected.timings, ...selected.undated_timings, ...selected.reporting_cutoffs];
  const samples = [...selected.sampling_assessments, ...selected.undated_sampling_assessments];
  const contexts = [...selected.contexts, ...selected.undated_contexts];
  const records = new Set([...all, ...timings, ...samples, ...contexts].map(row => row.record_id));
  assert.deepEqual([...index.keys()], [...records]);
  for (const record of records) {
   const nodeIds = new Set(all.filter(node => node.record_id === record).map(node => node.id));
   for (const id of nodeIds) for (const relation of relations) {
    if (relation.from_node_id === id) nodeIds.add(relation.to_node_id);
    if (relation.to_node_id === id) nodeIds.add(relation.from_node_id);
   }
   const nodes = all.filter(node => nodeIds.has(node.id));
   const links = relations.filter(relation => nodeIds.has(relation.from_node_id) && nodeIds.has(relation.to_node_id));
   const matches = (row: {record_id: string; node_id?: string}) => healthPanelForEntry(row, record, nodeIds);
   assert.deepEqual(index.get(record), {nodeIds, counts: {network: nodes.length, evidence: links.length, timeline: timings.filter(matches).length, sampling: samples.filter(matches).length, environment: contexts.filter(matches).length}, domains: new Set(nodes.map(node => node.domain)), dated: [...selected.timings, ...selected.sampling_assessments, ...selected.contexts].some(matches), fraction: samples.some(row => matches(row) && row.display === 'proportion' && row.proportion !== null), negative: nodes.some(node => node.finding === 'agent_not_detected'), hypothesis: links.some(row => row.basis === 'source_hypothesis') || contexts.some(row => matches(row) && row.kind === 'source_hypothesis')});
  }
 }
});

test('Disconnected entry indexing visits record ownership linearly', () => {
 const view = selectView(healthPanelsFixture(), '2020-01-01', '2030-01-01').one_health!;
 const source = [...view.nodes, ...view.undated_nodes][0];
 const countReads = (count: number) => {
  let reads = 0;
  const nodes = Array.from({length: count}, (_, i) => ({...source, id: `node-${i}`, get record_id() { reads++; return `report-${i}`; }}));
  const index = healthEntryIndex({...view, nodes, undated_nodes: [], relations: [], timings: [], undated_timings: [], reporting_cutoffs: [], sampling_assessments: [], undated_sampling_assessments: [], contexts: [], undated_contexts: []});
  assert.equal(index.size, count);
  return reads;
 };
 assert.equal(countReads(200), countReads(100) * 2);
});
