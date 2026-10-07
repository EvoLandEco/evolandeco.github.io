import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { releaseSchema, type AtlasRelease } from "../src/lib/atlas-release";
import { validatePresentation, type PresentationKind } from "../src/lib/atlas-presentation";

const file = z.strictObject({ path: z.string().refine(isAbsolute), bytes: z.number().int().positive(), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
export const presentationPublicationSchema = z.strictObject({
  source_text: z.strictObject({ pointer_descriptor: releaseSchema.shape.source_text.unwrap(), data: file, schema: file }).optional(),
  watch: z.strictObject({ pointer_descriptor: releaseSchema.shape.watch.unwrap(), data: file, schema: file }).optional(),
});
export async function preparePresentation(input: unknown, release: AtlasRelease) {
  const publication = presentationPublicationSchema.parse(input);
  const descriptors: Pick<AtlasRelease, "source_text" | "watch"> = {};
  const files: { key: string; content: Buffer; path: string; sha256: string; bytes: number }[] = [];
  for (const kind of ["source_text", "watch"] as PresentationKind[]) {
    const entry = publication[kind];
    if (!entry) continue;
    const descriptor = entry.pointer_descriptor;
    assert.equal(descriptor.source_export_id, release.export_id, "Presentation export binding");
    if (release[kind]) assert.deepEqual(release[kind], descriptor, "Presentation authorization binding");
    const content = [];
    for (const [name, ref] of [[descriptor.path, entry.data], [descriptor.schema_path, entry.schema]] as const) {
      const bytes = await readFile(ref.path);
      assert.equal(bytes.length, ref.bytes, name);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), ref.sha256, name);
      content.push(bytes);
      files.push({ ...ref, key: `releases/${release.export_id}/presentation/${descriptor.sha256}/${name}`, content: bytes });
    }
    assert.equal(entry.data.sha256, descriptor.sha256);
    assert.equal(entry.data.bytes, descriptor.bytes);
    assert.equal(entry.schema.sha256, descriptor.schema_sha256);
    validatePresentation(kind, JSON.parse(content[0].toString()), { ...release, [kind]: descriptor });
    Object.assign(descriptors, { [kind]: descriptor });
  }
  return { descriptors, files };
}
export function requireCurrentPresentation(current: AtlasRelease, candidate: AtlasRelease) {
  for (const kind of ["source_text", "watch"] as const) if (current[kind]) {
    assert(candidate[kind], `Publication must retain ${kind}`);
    if (current.export_id === candidate.export_id) assert.deepEqual(candidate[kind], current[kind], `Same export must retain ${kind}`);
  }
}
