type Node = { id: string; domain: string };
type Edge = { id: string; from_node_id: string; to_node_id: string };
type Point = { x: number; y: number };

function roundedPath(points: Point[]) {
  let path = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const before = Math.hypot(b.x - a.x, b.y - a.y), after = Math.hypot(c.x - b.x, c.y - b.y);
    if (!before || !after) continue;
    const radius = Math.min(7, before / 2, after / 2);
    path += `L${b.x + (a.x - b.x) * radius / before} ${b.y + (a.y - b.y) * radius / before}`;
    path += `Q${b.x} ${b.y} ${b.x + (c.x - b.x) * radius / after} ${b.y + (c.y - b.y) * radius / after}`;
  }
  return path + `L${points.at(-1)!.x} ${points.at(-1)!.y}`;
}

export function healthLayout(nodes: Node[], edges: Edge[], domains: string[], availableWidth: number) {
  const byId = new Map(nodes.map(n => [n.id, n]));
  const routes = edges.filter(e => byId.has(e.from_node_id) && byId.has(e.to_node_id)).slice().sort((a, b) => a.id.localeCompare(b.id));
  const neighbors = new Map(nodes.map(n => [n.id, new Set<string>()]));
  for (const edge of routes) {
    neighbors.get(edge.from_node_id)!.add(edge.to_node_id);
    neighbors.get(edge.to_node_id)!.add(edge.from_node_id);
  }
  const visited = new Set<string>(), groups: Node[][] = [];
  for (const node of nodes) {
    if (visited.has(node.id) || !neighbors.get(node.id)!.size) continue;
    const pending = [node.id], component = new Set<string>();
    while (pending.length) {
      const id = pending.pop()!;
      if (component.has(id)) continue;
      component.add(id); visited.add(id);
      pending.push(...neighbors.get(id)!);
    }
    groups.push(nodes.filter(n => component.has(n.id)));
  }
  groups.push(nodes.filter(n => !visited.has(n.id)));
  const gap = 8 + routes.length * 6;
  const minimumWidth = domains.length * 76 + (domains.length + 1) * gap;
  const width = Math.max(minimumWidth, availableWidth);
  const points = new Map<string, Point & { width: number }>(), paths = new Map<string, string>();
  const cellWidth = (width - (domains.length + 1) * gap) / Math.max(1, domains.length);
  const lanes = domains.map((id, i) => ({id, x: gap + i * (cellWidth + gap), width: cellWidth}));
  let y = 56;
  for (const group of groups.filter(g => g.length)) {
    const members = group.slice().sort((a, b) => domains.indexOf(a.domain) - domains.indexOf(b.domain));
    const links = routes.filter(e => group.some(n => n.id === e.from_node_id));
    const top = y - 30;
    const columns = domains.map(domain => members.filter(n => n.domain === domain));
    y += links.length * 8;
    for (let row = 0; row < Math.max(...columns.map(c => c.length)); row++) {
      columns.forEach((column, i) => {
        const node = column[row];
        if (node) points.set(node.id, { x: lanes[i].x + cellWidth / 2, y, width: cellWidth });
      });
      y += 118;
    }
    const ports = new Map<string, string[]>();
    const endpoint = (edge: Edge, end: 'from' | 'to') => {
      const id = end === 'from' ? edge.from_node_id : edge.to_node_id;
      const other = end === 'from' ? edge.to_node_id : edge.from_node_id;
      const center = points.get(id)!, side = points.get(other)!.x >= center.x ? 1 : -1;
      return { id, center, side, key: `${edge.id}:${end}`, group: `${id}:${side}` };
    };
    for (const edge of links) for (const end of ['from', 'to'] as const) {
      const p = endpoint(edge, end);
      ports.set(p.group, [...(ports.get(p.group) ?? []), p.key]);
    }
    const port = (edge: Edge, end: 'from' | 'to') => {
      const p = endpoint(edge, end), neighbors = ports.get(p.group)!;
      const offset = neighbors.length === 1 ? 0 : -10 + 20 * neighbors.indexOf(p.key) / (neighbors.length - 1);
      const domain = byId.get(p.id)!.domain;
      const radius = domain === 'environment' ? 20 - Math.abs(offset) : domain === 'human' || domain === 'unknown' ? Math.sqrt(17 ** 2 - offset ** 2) : 17;
      return { x: p.center.x + p.side * (radius + 2), y: p.center.y + offset,
        rail: p.center.x + p.side * (cellWidth / 2 + 6 + links.indexOf(edge) * 6) };
    };
    for (const [index, edge] of links.entries()) {
      const a = port(edge, 'from'), b = port(edge, 'to');
      const start = points.get(edge.from_node_id)!, end = points.get(edge.to_node_id)!;
      const between = members.some(n => { const p = points.get(n.id)!; return p.y === start.y && p.x > Math.min(start.x, end.x) && p.x < Math.max(start.x, end.x); });
      if (start.y === end.y && start.x !== end.x && !between) paths.set(edge.id, roundedPath([a, b]));
      else if (Math.abs(start.x - end.x) <= cellWidth + gap) paths.set(edge.id, roundedPath([a, { x: a.rail, y: a.y }, { x: a.rail, y: b.y }, b]));
      else paths.set(edge.id, roundedPath([a, { x: a.rail, y: a.y }, { x: a.rail, y: top + index * 8 }, { x: b.rail, y: top + index * 8 }, { x: b.rail, y: b.y }, b]));
    }
  }
  return { width, minimumWidth, height: Math.max(80, y - 4), points, paths, lanes };
}
