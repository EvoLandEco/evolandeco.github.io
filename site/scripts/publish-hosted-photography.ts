import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const run = promisify(execFile);
import { getPublicPhotography } from "./photography-model";

async function main() {
  const manifest = process.argv[2];
  if (!manifest) throw new Error("Usage: node --import tsx scripts/publish-hosted-photography.ts /path/to/owner-manifest.json");
  const publicData = getPublicPhotography(JSON.parse(await fs.readFile(manifest, "utf8")));
  const images = publicData.albums.flatMap(album => album.photos.flatMap(photo => [photo.image.src, photo.image.thumbnail?.src].filter((src): src is string => Boolean(src))));
  const urls = [...new Set(images)];
  for (let start = 0; start < urls.length; start += 6) {
    await Promise.all(urls.slice(start, start + 6).map(async url => {
      const { stdout } = await run("curl", ["--head", "--fail", "--silent", "--show-error", "--max-time", "30", url]);
      if (!/^content-type: image\/webp\s*$/im.test(stdout) || !/^content-length: [1-9][0-9]*\s*$/im.test(stdout))
        throw new Error(`Image headers are invalid: ${url}`);
    }));
    if (start % 120 === 0) console.log(`Checked ${Math.min(start + 6, urls.length)}/${urls.length} image URLs`);
  }
  const target = "src/content-data/photography-public.json";
  await fs.writeFile(target + ".tmp", JSON.stringify(publicData, null, 2) + "\n");
  await fs.rename(target + ".tmp", target);
  console.log(`Published ${publicData.summary.photoCount} photographs in ${publicData.summary.albumCount} albums.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
