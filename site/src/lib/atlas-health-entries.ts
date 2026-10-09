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
  const entries = new Map([...records].map(id => [id, {
    nodeIds: new Set<string>(), counts: {network: 0, evidence: 0, timeline: 0, sampling: 0, environment: 0},
    domains: new Set<AtlasSelectedOneHealth["nodes"][number]["domain"]>(),
    dated: false, fraction: false, negative: false, hypothesis: false,
  }]));
  const componentRecords = new Map<Set<string>, Set<string>>();
  const recordComponents = new Map<string, Set<Set<string>>>();
  for (const node of all) {
    const component = components.get(node.id)!;
    if (!componentRecords.has(component)) componentRecords.set(component, new Set());
    componentRecords.get(component)!.add(node.record_id);
    if (!recordComponents.has(node.record_id)) recordComponents.set(node.record_id, new Set());
    const included = recordComponents.get(node.record_id)!;
    if (included.has(component)) continue;
    included.add(component);
    for (const id of component) entries.get(node.record_id)!.nodeIds.add(id);
  }
  for (const node of all) for (const id of componentRecords.get(components.get(node.id)!)!) {
    const entry = entries.get(id)!;
    entry.counts.network++;
    entry.domains.add(node.domain);
    entry.negative ||= node.finding === "agent_not_detected";
  }
  for (const relation of view.relations) for (const id of componentRecords.get(components.get(relation.from_node_id)!)!) {
    const entry = entries.get(id)!;
    entry.counts.evidence++;
    entry.hypothesis ||= relation.basis === "source_hypothesis";
  }
  type Panel = typeof timings[number] | typeof sampling[number] | typeof contexts[number];
  function addPanels(rows: Panel[], kind: "timeline" | "sampling" | "environment", dated: boolean) {
    for (const row of rows) {
      const ids = new Set([row.record_id]);
      if ("node_id" in row && row.node_id) {
        const component = components.get(row.node_id);
        if (component) for (const id of componentRecords.get(component)!) ids.add(id);
      }
      for (const id of ids) {
        const entry = entries.get(id)!;
        entry.counts[kind]++;
        entry.dated ||= dated;
        entry.fraction ||= "display" in row && row.display === "proportion" && row.proportion !== null;
        entry.hypothesis ||= "kind" in row && row.kind === "source_hypothesis";
      }
    }
  }
  addPanels(view.timings, "timeline", true);
  addPanels(view.undated_timings, "timeline", false);
  addPanels(view.reporting_cutoffs, "timeline", false);
  addPanels(view.sampling_assessments, "sampling", true);
  addPanels(view.undated_sampling_assessments, "sampling", false);
  addPanels(view.contexts, "environment", true);
  addPanels(view.undated_contexts, "environment", false);
  return entries;
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
