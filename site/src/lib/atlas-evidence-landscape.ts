import { z } from 'zod';
import { verifiedBytes } from './atlas-json';

const index = z.number().int().nonnegative();
const indices = z.array(index);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const group = z.object({ id: z.string(), identity: index, labels: indices, documents: indices });
const interval = z.tuple([z.number().nonnegative(), z.number().nonnegative(), z.number().nonnegative()]);
const landscapeSchema = z.object({
  version: z.literal(1), export_id: digest,
  scope: z.object({ publication_from: z.string(), publication_until: z.string(), capture_until: z.string() }),
  labels: z.array(z.object({ id: z.string(), name: z.string() })),
  sources: z.array(z.object({ id: z.string(), name: z.string() })),
  documents: z.array(z.object({ id: z.string(), title: z.string(), date: z.string(), url: z.url().refine(url => /^https?:\/\//.test(url)), source: index, labels: indices, entries: index })),
  bundles: z.array(z.object({ id: z.string(), labels: indices.min(2), records: z.array(z.string()).min(1), documents: indices.min(1) })),
  pairs: z.array(z.object({ labels: z.tuple([index, index]), documents: indices.min(1), entry_documents: indices })),
  removals: z.array(z.object({ source: index, documents: index, document_pairs_lost: index, entry_pairs_lost: index, bundles_lost: index })),
  months: z.array(z.object({ month: z.string(), groups: z.array(group), documents: index, edges: z.array(z.tuple([index, index, z.number().positive()])) })),
  null_model: z.object({ draws: index.positive(), strata: index, mutable_strata: index, pairs: z.array(z.object({ labels: z.tuple([index, index]), observed: index, global: interval, conditional: interval })) }),
});
export type EvidenceLandscape = z.infer<typeof landscapeSchema>;
export type LandscapeBundle = EvidenceLandscape['bundles'][number];
export type LandscapeGroup = z.infer<typeof group>;
export type LandscapePair = EvidenceLandscape['pairs'][number];
export type LandscapeSelection = { title: string; labels: number[]; documents: number[]; records?: string[]; note?: string };

export function parseEvidenceLandscape(value: unknown, exportId: string): EvidenceLandscape {
  const data = landscapeSchema.parse(value);
  if (data.export_id !== exportId) throw new Error('Evidence landscape belongs to another dataset release.');
  const check = (values: number[], size: number) => {
    if (values.some(n => n >= size) || new Set(values).size !== values.length) throw new Error('Invalid landscape membership.');
  };
  const ids = (values: { id: string }[]) => { if (new Set(values.map(v => v.id)).size !== values.length) throw new Error('Duplicate landscape identities.'); };
  ids(data.labels); ids(data.sources); ids(data.documents); ids(data.bundles);
  data.documents.forEach(d => { check(d.labels, data.labels.length); check([d.source], data.sources.length); });
  [...data.bundles, ...data.pairs, ...data.months.flatMap(m => m.groups)].forEach(g => { check(g.labels, data.labels.length); check(g.documents, data.documents.length); });
  data.pairs.forEach(p => { check(p.entry_documents, data.documents.length); if (p.entry_documents.some(d => !p.documents.includes(d))) throw new Error('Entry support exceeds document support.'); });
  data.months.forEach(m => {
    ids(m.groups); check(m.groups.map(g => g.identity), Number.MAX_SAFE_INTEGER);
    check(m.groups.flatMap(g => g.labels), data.labels.length);
    m.edges.forEach(([a,b]) => check([a,b], data.labels.length));
  });
  data.removals.forEach(r => check([r.source], data.sources.length));
  data.null_model.pairs.forEach(p => { check(p.labels, data.labels.length); for (const [low, , high] of [p.global,p.conditional]) if (low > high) throw new Error('Invalid randomization range.'); });
  return data;
}

export async function fetchEvidenceLandscape(exportId: string, signal: AbortSignal) {
  const root = '/atlas-evidence-landscape';
  const response = await fetch(`${root}/manifest.json`, { signal });
  if (!response.ok) throw new Error('The local Evidence landscape study is not available.');
  const manifest = z.object({ version: z.literal(1), export_id: digest, bytes: index.positive().max(8_000_000), sha256: digest }).parse(await response.json());
  if (manifest.export_id !== exportId) throw new Error('Evidence landscape belongs to another dataset release.');
  const bytes = await verifiedBytes(await fetch(`${root}/study.json`, { signal }), manifest);
  signal.throwIfAborted();
  return parseEvidenceLandscape(JSON.parse(new TextDecoder().decode(bytes)), exportId);
}

export function landscapeRivers(months: EvidenceLandscape['months']) {
  return months.slice(0,-1).flatMap((month,i) => month.groups.flatMap(source => months[i+1].groups.flatMap(target => {
    const labels = source.labels.filter(id => target.labels.includes(id));
    return labels.length ? [{ source: source.id, target: target.id, labels, month: i }] : [];
  })));
}
export function sourceSupport(data: EvidenceLandscape, documents: number[]) {
  const counts = new Map<number, number>();
  for (const id of new Set(documents)) { const source = data.documents[id].source; counts.set(source, (counts.get(source) ?? 0) + 1); }
  return [...counts].map(([source,count]) => ({ source, count })).sort((a,b) => b.count-a.count || a.source-b.source);
}
export const sharedLabels = (a: number[], b: number[]) => a.filter(id => b.includes(id));
export const unique = <T,>(values: T[]) => [...new Set(values)];
export const pairKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
