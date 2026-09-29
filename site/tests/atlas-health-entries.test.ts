import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareHealthEvidence, healthOverviewEvidence, healthEntryIndex, healthPanelForEntry, matchesHealthEntry } from '../src/lib/atlas-health-entries';
import { healthPanelsFixture } from './atlas-health-panels-fixture';
import { selectView } from '../src/lib/atlas-vendor/1.5/view.mjs';

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
