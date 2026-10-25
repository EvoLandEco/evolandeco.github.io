import { sharedLabels, unique, type EvidenceLandscape } from './atlas-evidence-landscape';

export function cosine(a: number[], b: number[]) {
  const aa = a.reduce((sum, value) => sum + value * value, 0);
  const bb = b.reduce((sum, value) => sum + value * value, 0);
  return aa && bb ? Math.min(1, a.reduce((sum, value, i) => sum + value * b[i], 0) / Math.sqrt(aa * bb)) : 0;
}

export function reportingProfiles(data: EvidenceLandscape) {
  const frequency = data.labels.map((_, label) => data.documents.filter(d => d.labels.includes(label)).length);
  const idf = frequency.map(n => n ? Math.log(data.documents.length / n) : 0);
  const documents = data.documents.map(d => idf.map((weight, label) => d.labels.includes(label) ? weight : 0));
  const sources = data.sources.map(() => data.labels.map(() => 0));
  data.documents.forEach(d => d.labels.forEach(label => { sources[d.source][label] += idf[label] / d.labels.length; }));
  return { documents, sources };
}

export function reportNeighbours(data: EvidenceLandscape, vectors: number[][], document: number, crossSource: boolean) {
  const seed = data.documents[document];
  return data.documents.flatMap((d, index) => {
    if (index === document || crossSource && d.source === seed.source) return [];
    const similarity = cosine(vectors[document], vectors[index]);
    return similarity > 0 ? [{ document: index, similarity, labels: sharedLabels(seed.labels, d.labels) }] : [];
  }).sort((a, b) => b.similarity - a.similarity || data.documents[b.document].date.localeCompare(data.documents[a.document].date) || data.documents[a.document].id.localeCompare(data.documents[b.document].id));
}

export function sourceAffinities(data: EvidenceLandscape, vectors: number[][], source: number) {
  const labels = data.sources.map((_, index) => unique(data.documents.filter(d => d.source === index).flatMap(d => d.labels)));
  return data.sources.flatMap((_, index) => index === source ? [] : [{ source: index, similarity: cosine(vectors[source], vectors[index]), labels: sharedLabels(labels[source], labels[index]) }])
    .sort((a, b) => b.similarity - a.similarity || a.source - b.source);
}

export function themeRoles(data: EvidenceLandscape, month: EvidenceLandscape['months'][number]) {
  const strength = new Map<number, number>();
  month.edges.forEach(([a, b, weight]) => {
    strength.set(a, (strength.get(a) ?? 0) + weight);
    strength.set(b, (strength.get(b) ?? 0) + weight);
  });
  const mass = month.edges.reduce((sum, edge) => sum + edge[2], 0);
  const edges = month.edges.map(([a, b, weight]) => [a, b, 2 * mass * weight / (strength.get(a)! * strength.get(b)!)] as const);
  return month.groups.filter(group => group.identity > 0).map(group => {
    const members = new Set(group.labels);
    let internal = 0, external = 0;
    edges.forEach(([a, b, weight]) => {
      if (members.has(a) && members.has(b)) internal += weight;
      else if (members.has(a) || members.has(b)) external += weight;
    });
    const labels = [...group.labels].sort((a, b) => {
      const support = (label: number) => group.documents.filter(i => data.documents[i].labels.includes(label)).length;
      return support(b) - support(a) || a - b;
    });
    return { ...group, title: labels.slice(0, 2).map(i => data.labels[i].name).join(' · '), centrality: 10 * external, density: 100 * internal / group.labels.length };
  });
}

export function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : 0;
}
