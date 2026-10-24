import { countryContinent } from "./globe-network-regions";
import type { NetworkPoint } from "./globe-network";

type Node = { location: [number, number]; countries?: string[] };

export function geographicGroups(nodes: Node[], componentOf: ReadonlyMap<string, number>) {
  const countries = new Map<string, number[]>(), envelopes = new Map<string, { code: string; members: number[] }>();
  const continents = new Map<string, { region: string; members: Set<number> }>();
  nodes.forEach((node, index) => {
    for (const code of new Set(node.countries)) {
      if (!countryContinent.has(code)) continue;
      countries.set(code, [...(countries.get(code) ?? []), index]);
      const key = `${code}:${componentOf.get(node.location.join(","))}`;
      if (!envelopes.has(key)) envelopes.set(key, { code, members: [] });
      envelopes.get(key)!.members.push(index);
      const region = countryContinent.get(code)!.id, continentKey = `${region}:${componentOf.get(node.location.join(","))}`;
      if (!continents.has(continentKey)) continents.set(continentKey, { region, members: new Set() });
      continents.get(continentKey)!.members.add(index);
    }
  });
  return { countries, envelopes: [...envelopes.entries()].map(([id, group]) => ({ id, ...group })),
    continents: [...continents.entries()].map(([id, group]) => ({ id, region: group.region, members: [...group.members] })) };
}

// The Minkowski sum of a convex hull and a disc gives a smooth enclosing contour.
export function geographicEnvelope(points: NetworkPoint[], radius: number): string {
  const sorted = [...new Map(points.map(point => [`${point.x},${point.y}`, point])).values()].sort((a, b) => a.x - b.x || a.y - b.y);
  if (!sorted.length) return "";
  if (sorted.length === 1) {
    const { x, y } = sorted[0];
    return `M${x - radius},${y}a${radius},${radius} 0 1 0 ${2 * radius},0a${radius},${radius} 0 1 0 ${-2 * radius},0Z`;
  }
  const cross = (a: NetworkPoint, b: NetworkPoint, c: NetworkPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (ordered: NetworkPoint[]) => {
    const hull: NetworkPoint[] = [];
    for (const point of ordered) {
      while (hull.length > 1 && cross(hull.at(-2)!, hull.at(-1)!, point) <= 0) hull.pop();
      hull.push(point);
    }
    return hull.slice(0, -1);
  };
  const hull = [...half(sorted), ...half([...sorted].reverse())];
  const normals = hull.map((point, i) => {
    const next = hull[(i + 1) % hull.length], dx = next.x - point.x, dy = next.y - point.y;
    const length = Math.hypot(dx, dy);
    return { x: dy / length * radius, y: -dx / length * radius };
  });
  return hull.map((point, i) => {
    const previous = normals[(i + hull.length - 1) % hull.length], next = normals[i];
    return `${i ? "L" : "M"}${point.x + previous.x},${point.y + previous.y}A${radius},${radius} 0 0 1 ${point.x + next.x},${point.y + next.y}`;
  }).join("") + "Z";
}
