import type { AtlasSelectedOneHealth } from './atlas-contract';

export const healthViews = [
  {value:'network',label:'Network'}, {value:'evidence',label:'Evidence'},
  {value:'timeline',label:'Timeline'}, {value:'sampling',label:'Sampling'},
  {value:'environment',label:'Environment'},
] as const;
export type HealthEntryView = typeof healthViews[number]['value'];
export function healthPanelForEntry(row:{record_id:string;node_id?:string}, recordId:string, nodeIds:Set<string>) {
  return row.record_id===recordId || Boolean(row.node_id && nodeIds.has(row.node_id));
}

// Availability follows the same explicit connected evidence as the figures.
export function healthEntryIndex(view:AtlasSelectedOneHealth) {
  const all=[...view.nodes,...view.undated_nodes];
  const adjacent=new Map(all.map(n=>[n.id,new Set<string>()]));
  for(const r of view.relations){adjacent.get(r.from_node_id)!.add(r.to_node_id);adjacent.get(r.to_node_id)!.add(r.from_node_id);}
  const components=new Map<string,Set<string>>();
  for(const node of all){
    if(components.has(node.id))continue;
    const component=new Set([node.id]);
    for(const id of component)for(const next of adjacent.get(id)!)component.add(next);
    for(const id of component)components.set(id,component);
  }
  const timings=[...view.timings,...view.undated_timings,...view.reporting_cutoffs];
  const sampling=[...view.sampling_assessments,...view.undated_sampling_assessments];
  const contexts=[...view.contexts,...view.undated_contexts];
  const records=new Set([...all,...timings,...sampling,...contexts].map(r=>r.record_id));
  return new Map([...records].map(id=>{
    const nodeIds=new Set(all.filter(n=>n.record_id===id).flatMap(n=>[...components.get(n.id)!]));
    const nodes=all.filter(n=>nodeIds.has(n.id));
    const relations=view.relations.filter(r=>nodeIds.has(r.from_node_id)&&nodeIds.has(r.to_node_id));
    const matches=(r:{record_id:string;node_id?:string})=>healthPanelForEntry(r,id,nodeIds);
    const samples=sampling.filter(matches),context=contexts.filter(matches);
    return [id,{nodeIds,counts:{network:nodes.length,evidence:relations.length,timeline:timings.filter(matches).length,sampling:samples.length,environment:context.length},
      domains:new Set(nodes.map(n=>n.domain)),
      dated:[...view.timings,...view.sampling_assessments,...view.contexts].some(matches),
      fraction:samples.some(s=>s.display==='proportion'&&s.proportion!==null),
      negative:nodes.some(n=>n.finding==='agent_not_detected'),
      hypothesis:relations.some(r=>r.basis==='source_hypothesis')||context.some(c=>c.kind==='source_hypothesis'),
    }];
  }));
}
export type HealthEntry = ReturnType<typeof healthEntryIndex> extends Map<string,infer T> ? T : never;
export function matchesHealthEntry(entry:HealthEntry, filters:string[]) {
  const views=filters.filter(f=>f.startsWith('view:')).map(f=>f.slice(5) as HealthEntryView);
  const domains=filters.filter(f=>f.startsWith('domain:')).map(f=>f.slice(7));
  return (!views.length||views.some(v=>entry.counts[v]>0)) &&
    (!domains.length||[...entry.domains].some(d=>domains.includes(d))) &&
    filters.filter(f=>f.startsWith('feature:')).every(f=>entry[f.slice(8) as 'dated'|'fraction'|'negative'|'hypothesis']);
}


export function healthOverviewEvidence(view: AtlasSelectedOneHealth) {
  const index = new Map<string, { nodes: AtlasSelectedOneHealth["nodes"]; reported: number; hypotheses: number; contested: number; types: Set<string>; documents: Set<string>; passages: Set<string> }>();
  const entry = (id: string) => {
    if (!index.has(id)) index.set(id, { nodes: [], reported: 0, hypotheses: 0, contested: 0, types: new Set(), documents: new Set(), passages: new Set() });
    return index.get(id)!;
  };
  for (const node of [...view.nodes, ...view.undated_nodes]) {
    const row = entry(node.record_id);
    row.nodes.push(node);
    node.document_ids.forEach(id => row.documents.add(id));
    node.evidence_ids.forEach(id => row.passages.add(id));
  }
  for (const relation of view.relations) for (const id of new Set(relation.record_ids)) {
    const row = entry(id);
    if (relation.contested) row.contested++;
    if (relation.basis === "source_hypothesis") row.hypotheses++;
    if (relation.contested || relation.basis === "source_hypothesis") continue;
    row.reported++;
    relation.evidence_types.forEach(type => row.types.add(type));
    relation.document_ids.forEach(id => row.documents.add(id));
    relation.evidence_ids.forEach(id => row.passages.add(id));
  }
  return new Map([...index].map(([id, row]) => [id, { ...row, rank: [row.reported, row.types.size, row.documents.size, row.passages.size, row.nodes.length] }]));
}

export function compareHealthEvidence(a: number[] = [], b: number[] = []) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (b[i] ?? 0) - (a[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}
