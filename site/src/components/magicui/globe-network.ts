import { packSiblings, packEnclose } from "d3-hierarchy";
import { GLOBE_RADIUS, rimIndicator, type GlobeProjection, type Vec3 } from "./globe-effects";

type Location = [number, number];
export type NetworkPoint = { x: number; y: number };
type Point = NetworkPoint;
type Link = { id: string; groupId?: string; from: Location; to: Location };
export type GlobeMode = "globe" | "map" | "network";
export type ViewMix = { map: number; network: number };

export function viewMix(from: ViewMix, mode: GlobeMode, progress: number): ViewMix {
  const p = Math.max(0, Math.min(1, progress));
  const ease = p * p * p * (p * (p * 6 - 15) + 10);
  const network = mode === "network" ? 1 : 0;
  const map = mode === "network" ? from.map : mode === "map" ? 1 : 0;
  return { map: from.map + (map - from.map) * p, network: from.network + (network - from.network) * ease };
}

export function networkLayout(locations: Location[], links: Link[]) {
  const keys = [...new Set([...locations, ...links.flatMap(link => [link.from, link.to])].map(location => location.join(",")))].sort();
  const index = new Map(keys.map((key, i) => [key, i]));
  const edges = [...new Set(links.map(link => [index.get(link.from.join(","))!, index.get(link.to.join(","))!].sort((a, b) => a - b).join(":")))].sort()
    .map(pair => pair.split(":").map(Number)).filter(([a, b]) => a !== b);
  const neighbors = keys.map(() => new Set<number>());
  for (const [a, b] of edges) { neighbors[a].add(b); neighbors[b].add(a); }
  const visited = new Set<number>(), components: number[][] = [];
  for (let i = 0; i < keys.length; i++) {
    if (visited.has(i)) continue;
    const pending = [i], component: number[] = [];
    visited.add(i);
    while (pending.length) {
      const node = pending.pop()!;
      component.push(node);
      for (const neighbor of neighbors[node]) if (!visited.has(neighbor)) { visited.add(neighbor); pending.push(neighbor); }
    }
    components.push(component.sort((a, b) => a - b));
  }
  components.sort((a, b) => b.length - a.length || a[0] - b[0]);
  const incident = new Set(links.flatMap(link => [link.from.join(","), link.to.join(",")]));
  const isolated = keys.filter(key => !incident.has(key));
  const circles = components.filter(members => incident.has(keys[members[0]])).map(members => {
    const local = new Map(members.map((member, i) => [member, i]));
    const points = stressLayout(members.length, edges.filter(([a]) => local.has(a)).map(([a, b]) => [local.get(a)!, local.get(b)!]));
    const bounds = packEnclose(points.map(point => ({ ...point, r: 0 })))!;
    const r = Math.sqrt(members.length);
    const scale = bounds.r ? (r - .5) / bounds.r : 0;
    return { r, members, points: points.map(point => ({ x: (point.x - bounds.x) * scale, y: (point.y - bounds.y) * scale })) };
  });
  const packed = packSiblings(circles), boundary = packEnclose(packed);
  const positions = new Map<string, Point>();
  const scale = boundary ? (isolated.length ? .77 : .92) / boundary.r : 1;
  if (boundary) for (const group of packed) group.members.forEach((member, i) => {
    positions.set(keys[member], { x: (group.x - boundary.x + group.points[i].x) * scale, y: (group.y - boundary.y + group.points[i].y) * scale });
  });
  const groups = packed.map(group => ({ x: (group.x - boundary!.x) * scale, y: (group.y - boundary!.y) * scale,
    r: group.r * scale, count: group.members.length }));
  // Equal-area annular bands keep isolated locations outside connected components.
  const inner = .88, outer = .99;
  const bands = Math.max(1, Math.round(Math.sqrt(isolated.length * (outer - inner) / (Math.PI * (outer + inner)))));
  const radii = Array.from({ length: bands }, (_, i) => inner + (i + .5) * (outer - inner) / bands);
  const totalRadius = radii.reduce((sum, radius) => sum + radius, 0);
  let placed = 0, cumulative = 0;
  radii.forEach((radius, band) => {
    cumulative += radius;
    const end = Math.round(isolated.length * cumulative / totalRadius), count = end - placed;
    for (let i = 0; i < count; i++) {
      const angle = 2 * Math.PI * (i + band / 2) / count - Math.PI / 2;
      positions.set(isolated[placed + i], { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
    }
    placed = end;
  });
  const pairs = new Map<string, Link[]>();
  for (const link of links) {
    const key = [link.from.join(","), link.to.join(",")].sort().join(";");
    pairs.set(key, [...(pairs.get(key) ?? []), link]);
  }
  const bends = new Map<string, number>();
  for (const group of pairs.values()) {
    group.sort((a, b) => (a.groupId ?? a.id).localeCompare(b.groupId ?? b.id));
    group.forEach((link, i) => bends.set(link.groupId ?? link.id, (i - (group.length - 1) / 2) * .08 * (link.from.join(",") < link.to.join(",") ? 1 : -1)));
  }
  const componentOf = new Map(components.flatMap((members, group) => members.map(member => [keys[member], group] as const)));
  return { positions, bends, isolated: new Set(isolated), groups, componentOf };
}

export function networkCurve(from: Point, to: Point, bend = 0) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
  return (t: number): Point => {
    if (!length) return { x: from.x + .07 * Math.sin(2 * Math.PI * t), y: from.y + .07 * (1 - Math.cos(2 * Math.PI * t)) };
    const offset = 4 * t * (1 - t) * bend;
    return { x: from.x + dx * t - dy / length * offset, y: from.y + dy * t + dx / length * offset };
  };
}

export function networkSurface(point: Point) {
  const radius2 = point.x * point.x + point.y * point.y;
  const height = 1 - radius2, magnification = 1 / (1 - .28 * height);
  return { x: point.x * magnification, y: point.y * magnification * .9 + height * .07,
    rotation: Math.atan2(-point.y, point.x), scale: 1 / Math.sqrt(1 + .84 ** 2 * radius2) };
}

export function networkProjection(geographic: GlobeProjection, curve: (t: number) => Point, mix: number): GlobeProjection {
  if (!mix) return geographic;
  if (mix === 1) return (_point, t = 0) => {
    const { x, y } = networkSurface(curve(t));
    return { x, y, z: GLOBE_RADIUS, visible: true };
  };
  const blend = (point: ReturnType<GlobeProjection>, t: number) => {
    const start = point.visible ? point : rimIndicator(point) ?? point;
    const end = networkSurface(curve(t)), z = point.z * (1 - mix) + GLOBE_RADIUS * mix;
    return { x: start.x * (1 - mix) + end.x * mix, y: start.y * (1 - mix) + end.y * mix, z, visible: point.visible || z >= 0 };
  };
  const project: GlobeProjection = (point, t = 0) => blend(geographic(point), t);
  if (geographic.split && mix < 1) project.split = (from: Vec3, to: Vec3, fromT = 0, toT = 1) => {
    const edges = geographic.split!(from, to, fromT, toT);
    if (!edges) return null;
    const t = fromT + (toT - fromT) * from[2] / (from[2] - to[2]);
    return [blend(edges[0], t), blend(edges[1], t)];
  };
  return project;
}

export function stressLayout(count: number, edges: number[][]) {
  if (count === 1) return [{ x: 0, y: 0 }];
  const neighbors = Array.from({ length: count }, () => new Set<number>());
  for (const [a, b] of edges) { neighbors[a].add(b); neighbors[b].add(a); }
  const distances = neighbors.map((_, source) => {
    const row = Array<number>(count).fill(Infinity), queue = [source];
    row[source] = 0;
    for (let head = 0; head < queue.length; head++) for (const next of neighbors[queue[head]]) {
      if (Number.isFinite(row[next])) continue;
      row[next] = row[queue[head]] + 1; queue.push(next);
    }
    return row;
  });
  const points = Array.from({ length: count }, (_, i) => {
    const radius = Math.sqrt(i + .5), angle = i * Math.PI * (3 - Math.sqrt(5));
    return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
  });
  let previous = Infinity;
  // Local stress majorization, equation 12 in Gansner, Koren and North (2004).
  for (let step = 0; step < 400; step++) {
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, weight = 0;
      for (let j = 0; j < count; j++) {
        if (i === j) continue;
        const target = distances[i][j], w = 1 / (target * target);
        const dx = points[i].x - points[j].x, dy = points[i].y - points[j].y;
        const length = Math.hypot(dx, dy), ratio = length ? target / length : 0;
        x += w * (points[j].x + dx * ratio); y += w * (points[j].y + dy * ratio); weight += w;
      }
      points[i] = { x: x / weight, y: y / weight };
    }
    let stress = 0;
    for (let i = 0; i < count; i++) for (let j = i + 1; j < count; j++) {
      stress += (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) / distances[i][j] - 1) ** 2;
    }
    if (previous - stress <= previous * 1e-5 && Number.isFinite(previous)) break;
    previous = stress;
  }
  return points;
}
