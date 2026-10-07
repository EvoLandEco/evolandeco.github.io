export type SourceTextRow = {
  id: string; kind: "document_title" | "record_title" | "evidence"; target_ids: string[];
  document_id: string; original_text_sha256: string; source_text_sha256: string;
  language_tag: string; english_translation_id: string | null;
};
export type SourceTranslation = { id: string; original_text_id: string; text: string; language_tag: "en";
  origin: "atlas_generated" | "publisher_provided"; review_status: "unreviewed" | "source_checked" | "human_approved" };
export type SourceTextData = { texts: SourceTextRow[]; translations: SourceTranslation[];
  claim_bindings: { record_id: string; claim_index: number; quote_index: number; text_id: string | null; evidence_ids: string[] }[] };

export function indexSourceText(data: SourceTextData) {
  const texts = new Map(data.texts.map(row => [row.id, row]));
  const titles = new Map<string, SourceTextRow>(), evidence = new Map<string, SourceTextRow>();
  for (const row of data.texts) for (const id of row.target_ids) (row.kind === "evidence" ? evidence : titles).set(id, row);
  const claims = new Map<string, SourceTextRow>();
  for (const binding of data.claim_bindings) {
    const row = binding.text_id === null ? undefined : texts.get(binding.text_id);
    if (row) claims.set(JSON.stringify([binding.record_id, binding.claim_index, binding.quote_index]), row);
  }
  const translations = new Map(data.translations.map(row => [row.id, row]));
  return { titles, evidence, claims, translations };
}
export type SourceTextIndex = ReturnType<typeof indexSourceText>;
