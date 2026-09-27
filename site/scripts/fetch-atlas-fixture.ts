import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import fixture from "../tests/atlas-fixture.json";
import { atlasOrigin, verifiedBytes } from "../src/lib/atlas-release";

async function main() {
  const root = new URL("../.cache/atlas-fixture/", import.meta.url);
  await mkdir(root, { recursive: true });
  for (const [name, expected] of Object.entries(fixture.assets)) {
    const path = new URL(name, root);
    const local = await readFile(path).catch(() => null);
    if (local?.length === expected.bytes && createHash("sha256").update(local).digest("hex") === expected.sha256) continue;
    const bytes = await verifiedBytes(await fetch(`${atlasOrigin}/releases/${fixture.export_id}/${name}`), expected);
    await writeFile(path, new Uint8Array(bytes));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
