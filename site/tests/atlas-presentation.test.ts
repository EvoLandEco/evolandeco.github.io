import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import fixture from "./atlas-presentation-fixture.json";
import { releaseSchema } from "../src/lib/atlas-release";
import { validatePresentation } from "../src/lib/atlas-presentation";
import { indexSourceText, type SourceTextData } from "../src/lib/atlas-source-text";
import { selectWatch } from "../src/lib/atlas-vendor/presentation/0.1/watch-view.mjs";
import type { WatchData } from "../src/lib/atlas-presentation";
import { preparePresentation, requireCurrentPresentation } from "../scripts/publish-atlas-presentation";

const release = releaseSchema.parse(fixture.release);
test("Paired source text keeps exact targets, draft status and claim coordinates", () => {
  const text = validatePresentation("source_text", fixture.text, release) as SourceTextData;
  const index = indexSourceText(text), binding = text.claim_bindings[0];
  const row = index.claims.get(JSON.stringify([binding.record_id, binding.claim_index, binding.quote_index]))!;
  assert.equal(row.id, binding.text_id);
  assert.equal(index.evidence.get(binding.evidence_ids[0]), row);
  assert.equal(index.translations.get(row.english_translation_id!)?.review_status, "unreviewed");
  assert.equal(index.claims.get(JSON.stringify([binding.record_id, binding.claim_index, 999])), undefined);
  for (const mutate of [
    (data: typeof fixture.text) => { data.source_export_id = "f".repeat(64); },
    (data: typeof fixture.text) => { data.source_text_sha256 = "f".repeat(64); },
    (data: typeof fixture.text) => { data.texts.push(data.texts[0]); },
    (data: typeof fixture.text) => { data.translations[0].original_text_id = "missing"; },
    (data: typeof fixture.text) => { data.claim_bindings[0].evidence_ids = ["unrelated"]; },
  ]) { const data = structuredClone(fixture.text); mutate(data); assert.throws(() => validatePresentation("source_text", data, release)); }
});
test("Watch selection requires every supporting record and honors review cutoff", () => {
  const data = validatePresentation("watch", fixture.watch, release) as WatchData;
  const item = data.items[0];
  assert.equal(selectWatch(data, item.record_ids).length, 1);
  assert.equal(selectWatch(data, []).length, 0);
  assert.equal(selectWatch(data, item.record_ids, "2000-01-01T00:00:00Z").length, 0);
  assert.throws(() => selectWatch(data, item.record_ids, "2026-10-07"));
  assert.throws(() => validatePresentation("watch", { ...data, map_snapshot_sha256: "f".repeat(64) }, release));
  assert.throws(() => requireCurrentPresentation(release, { ...release, watch: undefined }));
});
test("Presentation schema pins and producer delivery files agree", async () => {
  for (const kind of ["source_text", "watch"] as const) {
    const desc = release[kind]!;
    const bytes = await readFile(new URL(`../src/lib/atlas-vendor/presentation/0.1/${desc.schema_path}`, import.meta.url));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), desc.schema_sha256);
  }
  if (process.env.ATLAS_PRESENTATION_FIXTURE) {
    const path = process.env.ATLAS_PRESENTATION_FIXTURE;
    const publication = JSON.parse(await readFile(`${path}/publication.json`, "utf8"));
    const prepared = await preparePresentation(publication, release);
    assert.equal(prepared.files.length, 4);
    assert.equal(prepared.descriptors.source_text?.sha256, release.source_text?.sha256);
  }
});
