import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import data from "../src/content-data/portfolio.json";
const root = process.cwd();
assert.equal(
  data.publications.filter((p) => p.status === "peer-reviewed").length,
  8,
);
assert.equal(
  data.publications.filter((p) => p.status === "preprint").length,
  2,
);
for (const list of [data.publications, data.projects, data.software])
  assert.equal(new Set(list.map((x) => x.id)).size, list.length);
for (const p of data.projects) {
  for (const id of p.publicationIds)
    assert(data.publications.some((x) => x.id === id));
  for (const id of p.softwareIds)
    assert(data.software.some((x) => x.id === id));
}
const bib = fs.readFileSync("public/publications.bib", "utf8");
const entries = bib
  .split(/(?=@(?:article|misc)\{)/i)
  .filter((x) => x.startsWith("@"));
fs.mkdirSync("public/citations", { recursive: true });
for (const p of data.publications) {
  const entry = entries.find((e) => e.includes(p.doi));
  assert(entry, `Missing citation: ${p.id}`);
  fs.writeFileSync(`public/citations/${p.id}.bib`, entry.trim() + "\n");
}
fs.writeFileSync("public/selected-publications.bib", data.publications
  .filter((p) => p.authors[0]?.isOwner)
  .map((p) => fs.readFileSync(`public/citations/${p.id}.bib`, "utf8").trim())
  .join("\n\n") + "\n");
for (const item of data.iconCloudItems)
  assert(
    fs.existsSync(path.join(root, "public", item.assetPath)),
    `Missing toolkit asset: ${item.assetPath}`,
  );
assert(fs.existsSync("src/content-data/photography-public.json"), "Missing public photography manifest");
console.log("Validated professional content, citations and toolkit assets.");

const ui = {
  navigation: data.navigation,
  iconCloudItems: data.iconCloudItems,
  software: data.software.map(({ id, name, role }) => ({ id, name, role })),
  publications: data.publications.filter((p) => p.authors[0]?.isOwner).map(
    ({ id, title, venue, year, status, authors }) => ({
      id,
      title,
      venue,
      year,
      status,
      authors: authors.map(({ displayName }) => ({ displayName })),
    }),
  ),
};
fs.writeFileSync(
  "src/content-data/ui-content.json",
  JSON.stringify(ui, null, 2) + "\n",
);
