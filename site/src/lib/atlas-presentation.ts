import { z } from "zod";
import textSchema from "./atlas-vendor/presentation/0.1/source-text-display.schema.json";
import watchSchema from "./atlas-vendor/presentation/0.1/watch.schema.json";
import { releaseRoot, verifiedBytes, type AtlasRelease } from "./atlas-release";
import { indexSourceText, type SourceTextData } from "./atlas-source-text";

export const presentationSchemas = { source_text: textSchema, watch: watchSchema };
const parsers = { source_text: z.fromJSONSchema(textSchema as Parameters<typeof z.fromJSONSchema>[0]), watch: z.fromJSONSchema(watchSchema as Parameters<typeof z.fromJSONSchema>[0]) };
export type WatchData = { watch_version: "0.1.0"; source_export_id: string; source_site_sha256: string; map_snapshot_sha256: string;
  review_scope: string; limitations: string[]; items: { id: string; label: string; reason_for_attention: string; follow_up_question: string;
    record_id: string; record_ids: string[]; document_ids: string[]; evidence_ids: string[]; assertion_ids: string[];
    diagnostic_label: string | null; diagnostic_status: { value: string | null; status: string }; reviewed_at: string;
    eligibility: { record_ids: string[] }; latest_publication: string; latest_capture: string;
    sources: { document_id: string; channel_id: string; title: string; publication: string }[] }[] };
export type PresentationKind = "source_text" | "watch";
function requireValid(value: unknown, message: string): asserts value { if (!value) throw new Error(`Invalid ATLAS presentation: ${message}`); }
export function validatePresentation(kind: PresentationKind, value: unknown, release: AtlasRelease) {
  const data = parsers[kind].parse(value) as Record<string, unknown>;
  requireValid(data.source_export_id === release.export_id, "scientific export binding");
  if (kind === "watch") {
    requireValid(data.source_site_sha256 === release.assets["atlas-site.json"].sha256 && data.map_snapshot_sha256 === release.assets["map.json"].sha256, "watch source binding");
    const watch = data as unknown as WatchData;
    requireValid(new Set(watch.items.map(item => item.id)).size === watch.items.length, "duplicate watch item");
    return watch;
  }
  requireValid(data.source_text_sha256 === release.source_text?.catalogue_sha256, "text catalogue binding");
  const text = data as unknown as SourceTextData;
  const rows = new Map(text.texts.map(row => [row.id, row]));
  const translations = new Map(text.translations.map(row => [row.id, row]));
  requireValid(rows.size === text.texts.length && translations.size === text.translations.length, "duplicate text identity");
  const targets = new Set<string>();
  for (const row of text.texts) {
    try { new Intl.Locale(row.language_tag); } catch { throw new Error("Invalid ATLAS text language tag"); }
    for (const id of row.target_ids) {
      const key = `${row.kind}:${id}`;
      requireValid(!targets.has(key), "duplicate text target"); targets.add(key);
    }
    if (row.english_translation_id) requireValid(translations.get(row.english_translation_id)?.original_text_id === row.id, "translation pairing");
  }
  for (const translation of translations.values()) requireValid(rows.get(translation.original_text_id)?.english_translation_id === translation.id, "orphan translation");
  const claims = new Set<string>();
  for (const binding of text.claim_bindings) {
    const key = JSON.stringify([binding.record_id, binding.claim_index, binding.quote_index]);
    requireValid(!claims.has(key), "duplicate claim binding"); claims.add(key);
    if (binding.text_id !== null) {
      const row = rows.get(binding.text_id);
      requireValid(row?.kind === "evidence" && binding.evidence_ids.every(id => row.target_ids.includes(id)), "claim evidence binding");
    }
  }
  return text;
}
export async function fetchAtlasPresentation(release: AtlasRelease, signal?: AbortSignal) {
  const result: { sourceText?: ReturnType<typeof indexSourceText>; watch?: WatchData } = {};
  await Promise.all((["source_text", "watch"] as const).map(async kind => {
    const descriptor = release[kind];
    if (!descriptor) return;
    requireValid(descriptor.source_export_id === release.export_id, "descriptor export binding");
    const response = await fetch(`${releaseRoot(release)}/presentation/${descriptor.sha256}/${descriptor.path}`, { signal });
    const bytes = await verifiedBytes(response, descriptor);
    signal?.throwIfAborted();
    const data = validatePresentation(kind, JSON.parse(new TextDecoder().decode(bytes)), release);
    if (kind === "source_text") result.sourceText = indexSourceText(data as SourceTextData);
    else result.watch = data as WatchData;
  }));
  return result;
}
