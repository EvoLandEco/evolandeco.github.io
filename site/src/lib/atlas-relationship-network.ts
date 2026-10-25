import { hierarchy, pack, packEnclose, packSiblings } from 'd3-hierarchy';
import { supported, type AtlasAssessment, type AtlasRecord } from './atlas';

export type RelationshipNetworkNode = {
  id: string; kind: 'relationship' | 'report'; reference: string;
};

export function relationshipNetwork(entries: AtlasAssessment[], records: Map<string, AtlasRecord>, recordIds: Set<string>) {
  const nodes = new Map<string, RelationshipNetworkNode>();
  const neighbors = new Map<string, Set<string>>();
  const edges: { id: string; from: string; to: string; assessment: string }[] = [];
  const reports = new Map<string, Set<string>>();
  for (const entry of [...entries].sort((a, b) => a.id.localeCompare(b.id))) {
    const id = `relationship:${entry.id}`;
    nodes.set(id, { id, kind: 'relationship', reference: entry.id });
    neighbors.set(id, new Set());
    const support = [...entry.support, ...(entry.updates ?? []).filter(update => supported(update.support, recordIds)).flatMap(update => update.support)];
    const documents = new Set<string>();
    for (const [recordId] of support) {
      const record = records.get(recordId);
      if (!record || !recordIds.has(recordId)) continue;
      documents.add(record.document_id);
      if (!reports.has(record.document_id)) reports.set(record.document_id, new Set());
      reports.get(record.document_id)!.add(recordId);
    }
    for (const document of [...documents].sort()) {
      const reportId = `report:${document}`;
      nodes.set(reportId, { id: reportId, kind: 'report', reference: document });
      if (!neighbors.has(reportId)) neighbors.set(reportId, new Set());
      neighbors.get(id)!.add(reportId);
      neighbors.get(reportId)!.add(id);
      edges.push({ id: `${id}:${reportId}`, from: reportId, to: id, assessment: entry.id });
    }
  }
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const id of [...nodes.keys()].sort()) {
    if (seen.has(id)) continue;
    const queue = [id];
    seen.add(id);
    for (let i = 0; i < queue.length; i++) for (const next of neighbors.get(queue[i])!) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    components.push(queue.sort());
  }
  components.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]));
  const componentByNode = new Map(components.flatMap((ids, index) => ids.map(id => [id, index] as const)));
  const componentEdges = components.map(() => [] as typeof edges);
  for (const edge of edges) componentEdges[componentByNode.get(edge.from)!].push(edge);
  const groups = components.map((ids, component) => ({ id: ids[0], links: componentEdges[component], nodes: ids.map(id => nodes.get(id)!) }));
  return { groups, edges, reports, neighbors, entryCount: entries.length,
    groupByEntry: new Map(groups.flatMap(group => group.nodes.filter(node => node.kind === 'relationship').map(node => [node.reference, group.id]))) };
}

export type RelationshipGraph = ReturnType<typeof relationshipNetwork>;
export type RelationshipGroup = RelationshipGraph['groups'][number];

export function relationshipSources(graph: RelationshipGraph, records: Map<string, AtlasRecord>) {
  return new Map(graph.groups.map(group => {
    const sources = new Set<string>();
    for (const node of group.nodes) if (node.kind === 'report') {
      for (const id of graph.reports.get(node.reference)!) sources.add(records.get(id)!.source);
    }
    return [group.id, [...sources].sort()];
  }));
}

const typeOrder = ['transmission', 'exposure', 'unresolved', 'identity', 'movement'];
const compareTypes = (a: string, b: string) => (typeOrder.includes(a) ? typeOrder.indexOf(a) : typeOrder.length) - (typeOrder.includes(b) ? typeOrder.indexOf(b) : typeOrder.length) || a.localeCompare(b);
const polar = (radius: number, angle: number) => ({ x: radius * Math.cos(angle), y: radius * Math.sin(angle) });

export function relationshipGroupFilter(graph: RelationshipGraph, entries: Map<string, AtlasAssessment>, sources: Map<string, string[]>, types: string[], publishers: string[]) {
  const groups: RelationshipGroup[] = [], counts = new Map<string, number>();
  const typeCounts = new Map<string, number>(), sourceCounts = new Map<string, number>();
  let entryCount = 0, reportCount = 0;
  for (const group of graph.groups) {
    const members = group.nodes.filter(node => node.kind === 'relationship').map(node => entries.get(node.reference)!);
    const groupSources = sources.get(group.id)!;
    const matchesType = !types.length || members.some(entry => types.includes(entry.type));
    const matchesSource = !publishers.length || groupSources.some(source => publishers.includes(source));
    for (const entry of members) typeCounts.set(entry.type, (typeCounts.get(entry.type) ?? 0) + (matchesSource ? 1 : 0));
    for (const source of groupSources) sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + (matchesType ? 1 : 0));
    if (!matchesType || !matchesSource) continue;
    groups.push(group);
    entryCount += members.length;
    reportCount += group.nodes.length - members.length;
    for (const entry of members) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
  }
  return { groups, entryCount, reportCount, typeCounts, sourceCounts,
    counts: [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => ({ type, count })) };
}

export function relationshipOverview(graph: Pick<RelationshipGraph, 'groups'>, entries: Map<string, AtlasAssessment>, width = 1000, height = 1000) {
  const summaries = graph.groups.map(group => {
    const counts = new Map<string, number>();
    let first = '';
    for (const node of group.nodes) if (node.kind === 'relationship') {
      if (!first) first = node.reference;
      const type = entries.get(node.reference)!.type;
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const count = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const parts = [...counts].sort(([a], [b]) => compareTypes(a, b)).map(([type, n]) => ({ type, fraction: n / count }));
    return { id: group.id, count, first, parts };
  });
  if (!summaries.length) return [];
  type Bubble = { group?: typeof summaries[number]; children?: Bubble[] };
  const root = hierarchy<Bubble>({ children: summaries.map(group => ({ group })) }).sum(node => node.group?.count ?? 0)
    .sort((a, b) => b.value! - a.value! || a.data.group!.id.localeCompare(b.data.group!.id));
  return pack<Bubble>().size([width, height]).padding(16)(root).leaves().map(node => ({
    ...node.data.group!, x: node.x - width / 2, y: node.y - height / 2, radius: node.r,
  }));
}

export function relationshipArc(radius: number, start: number, end: number, reverse = false) {
  const a = polar(radius, reverse ? end : start), b = polar(radius, reverse ? start : end);
  return `M${a.x} ${a.y}A${radius} ${radius} 0 ${end - start > Math.PI ? 1 : 0} ${reverse ? 0 : 1} ${b.x} ${b.y}`;
}

export function relationshipWedge(radius: number, start: number, portion: number) {
  const point = (turn: number) => { const p = polar(radius, turn * Math.PI * 2 - Math.PI / 2); return `${p.x} ${p.y}`; };
  return `M0 0L${point(start)}A${radius} ${radius} 0 0 1 ${point(start + portion / 2)}A${radius} ${radius} 0 0 1 ${point(start + portion)}Z`;
}

export function relationshipRing(radius: number, parts: { type: string; fraction: number }[]) {
  const width = radius * .22, ringRadius = radius - width / 2;
  let start = 0;
  return { width, parts: parts.map(part => {
    const trim = part.fraction < 1 ? Math.min(width * .6 / (2 * Math.PI * ringRadius), part.fraction / 4) : 0;
    const arc = { radius: ringRadius, start: (start + trim) * 2 * Math.PI - Math.PI / 2, end: (start + part.fraction - trim) * 2 * Math.PI - Math.PI / 2 };
    const path = relationshipMorphArc(arc, arc, 0);
    const clip = relationshipWedge(radius * 1.1, start, part.fraction);
    start += part.fraction;
    return { ...part, ...arc, path, clip };
  }) };
}

export function relationshipMorphArc(from: { radius: number; start: number; end: number }, to: typeof from, progress: number) {
  const radius = from.radius + (to.radius - from.radius) * progress;
  const start = from.start + (to.start - from.start) * progress;
  const end = from.end + (to.end - from.end) * progress;
  const point = (angle: number) => { const p = polar(radius, angle); return `${p.x} ${p.y}`; };
  return `M${point(start)}A${radius} ${radius} 0 0 1 ${point((start + end) / 2)}A${radius} ${radius} 0 0 1 ${point(end)}`;
}

export function relationshipSourceColors(sources: string[]) {
  const catalogue = [...new Set(sources)].sort();
  return new Map(catalogue.map((source, index) => [source, `oklch(${index % 2 ? 72 : 60}% .12 ${(220 + index * 360 / catalogue.length) % 360})`]));
}

export function relationshipSourceShapes(sources: string[]) {
  const shapes = [
    'M-.5 -.78H.5Q.78 -.78 .78 -.5V.5Q.78 .78 .5 .78H-.5Q-.78 .78 -.78 .5V-.5Q-.78 -.78 -.5 -.78Z',
    'M0 -.9A.9 .9 0 1 1 0 .9A.9 .9 0 1 1 0 -.9Z',
    'M-.12 -.91Q0 -1.03 .12 -.91L.91 -.12Q1.03 0 .91 .12L.12 .91Q0 1.03 -.12 .91L-.91 .12Q-1.03 0 -.91 -.12Z',
    'M-.36 -.78H.36Q.46 -.78 .51 -.69L.88 -.09Q.93 0 .88 .09L.51 .69Q.46 .78 .36 .78H-.36Q-.46 .78 -.51 .69L-.88 .09Q-.93 0 -.88 -.09L-.51 -.69Q-.46 -.78 -.36 -.78Z',
    'M-.12 -.91Q0 -1.12 .12 -.91L.88 .41Q1 .62 .76 .62H-.76Q-1 .62 -.88 .41Z',
    'M-.3 -.65H.3A.65 .65 0 0 1 .3 .65H-.3A.65 .65 0 0 1 -.3 -.65Z',
  ];
  return new Map([...new Set(sources)].sort().map((source, index) => [source, shapes[index % shapes.length]]));
}

export function relationshipSourceMarks(sources: string[]) {
  if (!sources.length) return [];
  const packed = packSiblings([...new Set(sources)].sort().map(source => ({ source, r: 1.12 })));
  const bounds = packEnclose(packed)!;
  return packed.map(mark => ({ source: mark.source, x: (mark.x - bounds.x) / bounds.r, y: (mark.y - bounds.y) / bounds.r, scale: 1 / bounds.r }));
}

export function relationshipCallout(node: { x: number; y: number; radius: number }, frame: { width: number; height: number }, card: { width: number; height: number }) {
  const margin = 8, gap = 20;
  const shiftX = (x: number) => Math.max(margin, Math.min(x, frame.width - card.width - margin));
  const shiftY = (y: number) => Math.max(margin, Math.min(y, frame.height - card.height - margin));
  const candidates = [
    { x: node.x + node.radius + gap, y: shiftY(node.y - card.height / 2), horizontal: true, direction: 1 },
    { x: node.x - node.radius - gap - card.width, y: shiftY(node.y - card.height / 2), horizontal: true, direction: -1 },
    { x: shiftX(node.x - card.width / 2), y: node.y + node.radius + gap, horizontal: false, direction: 1 },
    { x: shiftX(node.x - card.width / 2), y: node.y - node.radius - gap - card.height, horizontal: false, direction: -1 },
  ];
  const overflow = (p: typeof candidates[number]) => Math.max(0, margin - p.x) + Math.max(0, p.x + card.width + margin - frame.width)
    + Math.max(0, margin - p.y) + Math.max(0, p.y + card.height + margin - frame.height);
  const best = candidates.sort((a, b) => overflow(a) - overflow(b))[0];
  const x = shiftX(best.x), y = shiftY(best.y);
  const start = { x: node.x + (best.horizontal ? best.direction * node.radius : 0), y: node.y + (best.horizontal ? 0 : best.direction * node.radius) };
  const end = best.horizontal ? { x: x + (best.direction < 0 ? card.width : 0), y: y + card.height / 2 }
    : { x: x + card.width / 2, y: y + (best.direction < 0 ? card.height : 0) };
  const path = best.horizontal ? `M${start.x} ${start.y}H${(start.x + end.x) / 2}V${end.y}H${end.x}`
    : `M${start.x} ${start.y}V${(start.y + end.y) / 2}H${end.x}V${end.y}`;
  return { x, y, start, end, path };
}

export function relationshipLabelRotation(angles: number[]) {
  if (!angles.length) return 0;
  const folded = angles.map(angle => ((angle % Math.PI) + Math.PI) % Math.PI).sort((a, b) => a - b);
  let widestGap = -1, rotation = 0;
  // The complement of the largest gap gives the smallest possible worst label tilt.
  for (let i = 0; i < folded.length; i++) {
    const start = folded[i], end = folded[(i + 1) % folded.length] + (i === folded.length - 1 ? Math.PI : 0);
    if (end - start > widestGap) {
      widestGap = end - start;
      rotation = -(start + end) / 2;
    }
  }
  return Math.sin(angles[0] + rotation) > 0 ? rotation + Math.PI : rotation;
}

export function relationshipNodeOutline(kind: RelationshipNetworkNode['kind'], type: string, x = 0, y = 0) {
  const rounded = (w: number, h: number, r: number) => `M${x - w + r} ${y - h}H${x + w - r}a${r} ${r} 0 0 1 ${r} ${r}V${y + h - r}a${r} ${r} 0 0 1 ${-r} ${r}H${x - w + r}a${r} ${r} 0 0 1 ${-r} ${-r}V${y - h + r}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
  if (kind === 'report') return rounded(11, 13, 6);
  if (type === 'exposure') return rounded(7, 7, 4);
  if (type === 'identity') return rounded(8, 6, 6);
  if (type === 'unresolved') return `M${x} ${y - 8.5}L${x + 8.5} ${y}L${x} ${y + 8.5}L${x - 8.5} ${y}Z`;
  if (type === 'movement') return `M${x - 4} ${y - 7}H${x + 4}L${x + 8} ${y}L${x + 4} ${y + 7}H${x - 4}L${x - 8} ${y}Z`;
  return `M${x - 7} ${y}a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z`;
}

export function relationshipGroupLayout(group: RelationshipGroup, entries: Map<string, AtlasAssessment>, dates: Map<string, string>) {
  const reports = group.nodes.filter(node => node.kind === 'report').sort((a, b) => (dates.get(a.reference) ?? '').localeCompare(dates.get(b.reference) ?? '') || a.id.localeCompare(b.id));
  const packed = packSiblings(reports.map(node => ({ ...node, r: 25 })));
  const bounds = packed.length ? packEnclose(packed)! : { x: 0, y: 0, r: 0 };
  const sourceNodes = packed.map(node => ({ ...node, x: node.x - bounds.x, y: node.y - bounds.y }));
  const byType = new Map<string, typeof group.nodes>();
  for (const node of group.nodes) if (node.kind === 'relationship') {
    const type = entries.get(node.reference)!.type;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(node);
  }
  const types = [...byType.keys()].sort(compareTypes);
  const count = group.nodes.length - reports.length;
  const gap = .18;
  const step = Math.min(.38, (2 * Math.PI - gap * types.length) / count);
  const radius = Math.max(62, bounds.r + 35, 18 / (2 * Math.sin(step / 2)));
  let angle = -(step * count + gap * (types.length - 1)) / 2;
  const spans = types.map(type => {
    const members = byType.get(type)!;
    const start = angle, end = start + step * members.length;
    angle = end + gap;
    return { type, start, end, middle: (start + end) / 2 };
  });
  const rotation = relationshipLabelRotation(spans.map(span => span.middle));
  const sectors = spans.map(span => {
    const { type } = span;
    const members = byType.get(type)!;
    const start = span.start + rotation, end = span.end + rotation, middle = span.middle + rotation;
    return { type, start, end, middle, radius,
      label: polar(radius + 31, middle), anchor: polar(radius * .46, middle),
      labelArc: relationshipArc(radius + 31, middle - Math.PI / 2, middle + Math.PI / 2, Math.sin(middle) > 0),
      arc: relationshipArc(radius + 14, start, end),
      nodes: members.map((node, index) => ({ ...node, ...polar(radius, start + step * (index + .5)) })),
    };
  });
  const nodes = [...sourceNodes, ...sectors.flatMap(sector => sector.nodes)];
  const points = new Map(nodes.map(node => [node.id, node]));
  const sectorByType = new Map(sectors.map(sector => [sector.type, sector]));
  const edges = group.links.map(edge => {
    const a = points.get(edge.from)!, b = points.get(edge.to)!;
    const type = entries.get(edge.assessment)!.type;
    const anchor = sectorByType.get(type)!.anchor;
    return { ...edge, type, path: `M${a.x} ${a.y}C${a.x + (anchor.x - a.x) * .55} ${a.y + (anchor.y - a.y) * .55} ${anchor.x} ${anchor.y} ${b.x} ${b.y}` };
  });
  const frame = packEnclose([
    ...nodes.map(node => ({ x: node.x, y: node.y, r: node.kind === 'report' ? 32 : 13 })),
    ...sectors.map(sector => ({ ...sector.label, r: 4 + sector.type.length * 1.9 })),
  ])!;
  const extent = frame.r + 12;
  const edgeClip = `M${frame.x - extent} ${frame.y - extent}h${2 * extent}v${2 * extent}h${-2 * extent}Z` + nodes.map(node =>
    relationshipNodeOutline(node.kind, node.kind === 'relationship' ? entries.get(node.reference)!.type : '', node.x, node.y)).join('');
  return { nodes, sectors, edges, edgeClip, center: { x: frame.x, y: frame.y }, radius: Math.max(110, extent) };
}
