import { z } from "zod";
import schema from "./atlas-vendor/daily/0.2.1/daily.schema.json";
import { selectDaily } from "./atlas-vendor/daily/0.2.1/daily-view.mjs";
import type { DailyData } from "./atlas-vendor/daily/0.2.1/daily";
import { atlasOrigin, verifiedBytes, type AtlasRelease } from "./atlas-release";
import type { AtlasData } from "./atlas-contract";
import type { AtlasRecord } from "./atlas";
export type { DailyData, DailyDocument, DailyFinding, DailyEvidence, DailyWatch } from "./atlas-vendor/daily/0.2.1/daily";
export type DailySelection = ReturnType<typeof selectDaily>;
export type DailyState = { data?: DailyData; error?: string; loading?: boolean };
export const dailyPins = { schema: "91c8f56346d966f095006d3d0932c3f96d3d9a703312f6190ef8bbc957599c06", selector: "76a1c662f49d9e0fcc5e26e8f90f92be96abc765f9c3b2f824335364568fb5e0" };
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const dailyPointerSchema = z.strictObject({ version: z.literal(1), daily_version: z.literal("0.2.1"), daily_id: digest,
  base_source_export_id: digest, base_manifest_sha256: digest, published_at: z.iso.datetime(),
  asset: z.strictObject({ sha256: digest, bytes: z.number().int().positive() }),
  schema_sha256: z.literal(dailyPins.schema), selector_sha256: z.literal(dailyPins.selector) });
export type DailyPointer = z.infer<typeof dailyPointerSchema>;
const parser = z.fromJSONSchema(schema as Parameters<typeof z.fromJSONSchema>[0]);
function requireValid(value: unknown, message: string): asserts value { if (!value) throw new Error(`Invalid ATLAS daily data: ${message}`); }
const timestamp = (value: string) => z.iso.datetime({ offset: true }).parse(value);
const language = (value: string) => { new Intl.Locale(value); };
export async function validateDaily(value: unknown, release: AtlasRelease, manifestSha256: string): Promise<DailyData> {
  const data = parser.parse(value) as DailyData;
  requireValid(data.base_source_export_id === release.export_id && data.base_site_sha256 === release.assets["atlas-site.json"].sha256 && data.base_map_snapshot_sha256 === release.assets["map.json"].sha256 && data.base_manifest_sha256 === manifestSha256, "weekly source binding");
  timestamp(data.generated_at); timestamp(data.knowledge_cutoff);
  z.iso.date().parse(data.publication_from); z.iso.date().parse(data.publication_until);
  requireValid(data.publication_from <= data.publication_until, "publication range");
  const index = <T extends { id: string }>(rows: T[]) => { const map = new Map(rows.map(row => [row.id, row])); requireValid(map.size === rows.length, "duplicate identity"); return map; };
  const docs = index(data.documents), findings = index(data.findings), evidence = index(data.evidence), assessments = index(data.watch_assessments); index(data.watch_items);
  for (const doc of docs.values()) {
    timestamp(doc.capture); if (doc.reviewed_at) timestamp(doc.reviewed_at);
    if (doc.publication) { if (doc.publication.includes("T")) timestamp(doc.publication); else z.iso.date().parse(doc.publication); }
    for (const url of [doc.url, doc.content_url]) requireValid(["https:", "http:"].includes(new URL(url).protocol), "source URL");
    language(doc.language_tag);
    requireValid(doc.country_codes.every(code => /^[A-Z]{2}$/.test(code)), "country code");
    requireValid(doc.finding_ids.every(id => findings.get(id)?.document_id === doc.id), "document findings");
    if (doc.title_translation) requireValid(doc.title_translation.language_tag === "en", "title translation language");
  }
  for (const row of evidence.values()) {
    const doc = docs.get(row.document_id);
    requireValid(doc && doc.source_text_sha256 === row.source_text_sha256, "quotation source binding");
    requireValid(row.end - row.start === [...row.quote].length, "quotation offsets");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(row.quote)))].map(n => n.toString(16).padStart(2, "0")).join("");
    requireValid(hash === row.quote_sha256, "quotation hash"); language(row.language_tag);
  }
  for (const finding of findings.values()) {
    const doc = docs.get(finding.document_id);
    timestamp(finding.reviewed_at);
    requireValid(doc && doc.review_id === finding.review_id && doc.finding_ids.includes(finding.id), "finding review binding");
    requireValid(finding.evidence_ids.length && finding.evidence_ids.every(id => evidence.get(id)?.document_id === finding.document_id), "finding evidence binding");
  }
  for (const watch of data.watch_assessments) {
    timestamp(watch.reviewed_at); timestamp(watch.review_due_at);
    requireValid(Date.parse(watch.review_due_at) > Date.parse(watch.reviewed_at), "watch review period");
    if (watch.development_date) z.iso.date().parse(watch.development_date);
    requireValid(watch.finding_ids.length && watch.finding_ids.every(id => findings.has(id)), "watch findings");
    const support = watch.finding_ids.map(id => findings.get(id)!);
    const same = (a: string[], b: string[]) => a.length === new Set(a).size && new Set(a).size === new Set(b).size && b.every(id => a.includes(id));
    requireValid(same(watch.document_ids, support.map(f => f.document_id)) && same(watch.evidence_ids, support.flatMap(f => f.evidence_ids)), "watch support");
    const keys = new Map(support.map(f => [`${f.document_id}:${f.key}`, f.id]));
    requireValid(same(watch.finding_keys, [...keys.keys()]), "watch finding keys");
    requireValid([...watch.development_finding_keys, ...watch.follow_up_finding_keys, ...watch.counterevidence_finding_keys, ...watch.criteria.flatMap(row => row.finding_keys)].every(key => keys.has(key)), "watch assessment evidence");
    for (const fact of watch.key_facts) requireValid(fact.finding_keys.every(key => keys.has(key)) && same(fact.finding_ids, fact.finding_keys.map(key => keys.get(key)!)), "watch fact evidence");
  }
  requireValid(data.watch_items.every(watch => watch.attention !== "not_selected" && JSON.stringify(watch) === JSON.stringify(assessments.get(watch.id))), "watch decision binding");
  for (const row of data.reconciliations) timestamp(row.reviewed_at);
  selectDaily(data, data.publication_from, data.publication_until, "publication", data.knowledge_cutoff);
  return data;
}
export function validateDailyReferences(data: DailyData, weekly: Pick<AtlasData, "documents" | "channels">) {
  const documents = new Set(weekly.documents.map(doc => doc.id));
  const channels = new Map(weekly.channels.map(channel => [channel.id, channel.acquisition_source]));
  for (const doc of data.documents) {
    requireValid(doc.base_document_ids.every(id => documents.has(id)), "publication version binding");
    requireValid(doc.channel_id === null || channels.get(doc.channel_id) === doc.source_id, "source channel binding");
  }
}
export async function fetchDaily(release: AtlasRelease, manifestSha256: string, signal?: AbortSignal) {
  const root = `${atlasOrigin}/daily/${release.export_id}`;
  const response = await fetch(`${root}/current.json`, { signal, cache: "no-cache" });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Daily release unavailable (${response.status})`);
  const pointer = dailyPointerSchema.parse(await response.json());
  requireValid(pointer.base_source_export_id === release.export_id && pointer.base_manifest_sha256 === manifestSha256, "pointer source binding");
  const bytes = await verifiedBytes(await fetch(`${root}/${pointer.daily_id}/daily.json`, { signal }), pointer.asset);
  const data = await validateDaily(JSON.parse(new TextDecoder().decode(bytes)), release, manifestSha256);
  requireValid(data.daily_id === pointer.daily_id, "daily identity");
  signal?.throwIfAborted();
  return data;
}
export function dailySelection(data: DailyData, window: [string, string], sources: string[], countries: string[], asOf = new Date().toISOString()) {
  const selection = selectDaily(data, ...window, "publication", data.knowledge_cutoff, sources.length ? sources : null, countries.length ? countries : null, asOf);
  return { ...selection, reconciliations: selection.reconciliations.filter(row => row.weekly_export_id === data.base_source_export_id) };
}
export function dailyTitle(document: DailyData["documents"][number]) { return document.title_translation?.text ?? document.title; }
export function pendingDailyDocuments(selection: DailySelection, weeklyRecordIds: Set<string>) {
  const integrated = new Set(selection.reconciliations.filter(row => row.disposition === "integrated" && row.record_ids.length && row.record_ids.every(id => weeklyRecordIds.has(id))).map(row => row.review_id));
  return selection.documents.filter(doc => !(doc.processing_status === "weekly_reviewed" && doc.review_id && integrated.has(doc.review_id)));
}
export function reportChronology(weekly: AtlasRecord[][], daily: DailyData["documents"], dates: (id: string) => { publication: string; capture: string }) {
  type Entry = { id: string; records: AtlasRecord[]; weeklyVersions: AtlasRecord[][]; dailyVersions: DailyData["documents"]; publication: string; capture: string };
  const parent = new Map<string, string>();
  function root(id: string): string {
    const next = parent.get(id);
    if (!next) { parent.set(id, id); return id; }
    if (next === id) return id;
    const result = root(next); parent.set(id, result); return result;
  }
  for (const document of daily) for (const base of document.base_document_ids) parent.set(root(document.id), root(base));
  const entries = new Map<string, Entry>();
  const chronological = (a: { publication: string; capture: string; id: string }, b: { publication: string; capture: string; id: string }) => b.publication.localeCompare(a.publication) || b.capture.localeCompare(a.capture) || a.id.localeCompare(b.id);
  const weeklyEntries = weekly.map(records => ({ records, id: records[0].document_id, ...dates(records[0].document_id) })).sort(chronological);
  for (const entry of weeklyEntries) {
    const key = root(entry.id), existing = entries.get(key);
    if (existing) { existing.records.push(...entry.records); existing.weeklyVersions.push(entry.records); }
    else entries.set(key, { ...entry, records: [...entry.records], weeklyVersions: [entry.records], dailyVersions: [] });
  }
  for (const document of [...daily].sort((a, b) => b.capture.localeCompare(a.capture) || a.id.localeCompare(b.id))) {
    const key = root(document.id), existing = entries.get(key);
    if (existing) existing.dailyVersions.push(document);
    else entries.set(key, { id: document.id, records: [], weeklyVersions: [], dailyVersions: [document], publication: document.publication ?? "", capture: document.capture });
  }
  return [...entries.values()].sort(chronological);
}

export function highlightedReportIds(entries: ReturnType<typeof reportChronology>, recordIds: string[], documentIds: string[]) {
  const records = new Set(recordIds), documents = new Set(documentIds);
  return new Set(entries.filter(entry =>
    entry.records.some(record => records.has(record.id) || documents.has(record.document_id)) ||
    entry.dailyVersions.some(document => documents.has(document.id) || document.base_document_ids.some(id => documents.has(id)))
  ).map(entry => entry.id));
}
