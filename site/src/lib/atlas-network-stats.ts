import type { AtlasLink } from './atlas';

export function networkStatistics(links: AtlasLink[], countryCodes: ReadonlySet<string>, countriesForLink: (link: AtlasLink) => string[][]) {
  const nodes = new Map<string, { code: string; strength: number; neighbors: Set<string>; records: Set<string> }>();
  const pairs = new Map<string, { codes: string[]; weight: number; records: Set<string> }>();
  const arrivals = new Map<string, { code: string; weight: number; records: Set<string> }>();
  const seen = new Set<string>();
  const excluded = { hypotheses: 0, geography: 0, domestic: 0 };
  for (const link of links) {
    if (seen.has(link.id)) continue;
    seen.add(link.id);
    if (link.type === 'hypothesis') { excluded.hypotheses++; continue; }
    const endpoints = countriesForLink(link).map(codes => [...new Set(codes)]);
    if (endpoints.length !== 2 || endpoints.some(codes => codes.length !== 1 || !countryCodes.has(codes[0]))) { excluded.geography++; continue; }
    const [a, b] = endpoints.map(codes => codes[0]);
    if (a === b) { excluded.domestic++; continue; }
    if (link.type === 'movement' && link.directed) {
      const destination = arrivals.get(b) ?? { code: b, weight: 0, records: new Set<string>() };
      destination.weight++;
      link.support.forEach(([id]) => destination.records.add(id));
      arrivals.set(b, destination);
    }
    const codes = [a, b].sort();
    const key = JSON.stringify(codes);
    const pair = pairs.get(key) ?? { codes, weight: 0, records: new Set<string>() };
    pair.weight++;
    link.support.forEach(([id]) => pair.records.add(id));
    pairs.set(key, pair);
    for (const [code, neighbor] of [[a, b], [b, a]]) {
      const node = nodes.get(code) ?? { code, strength: 0, neighbors: new Set<string>(), records: new Set<string>() };
      node.strength++;
      node.neighbors.add(neighbor);
      link.support.forEach(([id]) => node.records.add(id));
      nodes.set(code, node);
    }
  }
  const rankedNodes = [...nodes.values()].sort((a, b) => b.strength - a.strength || a.code.localeCompare(b.code));
  const rankedPairs = [...pairs.values()].sort((a, b) => b.weight - a.weight || a.codes.join().localeCompare(b.codes.join()));
  const rankedDestinations = [...arrivals.values()].sort((a, b) => b.weight - a.weight || a.code.localeCompare(b.code));
  return { nodes: rankedNodes, pairs: rankedPairs, excluded,
    weight: rankedPairs.reduce((sum, pair) => sum + pair.weight, 0),
    hubs: rankedNodes.filter(node => node.strength === rankedNodes[0].strength),
    corridors: rankedPairs.filter(pair => pair.weight === rankedPairs[0].weight),
    destinations: rankedDestinations.filter(node => node.weight === rankedDestinations[0].weight),
  };
}
