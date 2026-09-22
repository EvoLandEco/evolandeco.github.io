import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import {
  validatePhotography,
  getPublicPhotography,
  type PhotographyData,
} from "./photography-model";
async function main() {
  const [command, manifestPath, sourceRoot, stagingRoot] =
    process.argv.slice(2);
  if (
    !["prepare", "publish"].includes(command) ||
    !manifestPath ||
    !sourceRoot ||
    !stagingRoot
  )
    throw new Error(
      "Usage: pnpm media prepare|publish /private/manifest.json /private/originals /private/staging",
    );
  await fs.mkdir(stagingRoot, { recursive: true });
  const source = await fs.realpath(sourceRoot),
    staging = await fs.realpath(stagingRoot),
    app = await fs.realpath(process.cwd());
  for (const p of [await fs.realpath(manifestPath), source, staging])
    if (p === app || p.startsWith(app + path.sep))
      throw new Error(
        "Keep authored photography data, originals and staging outside the application.",
      );
  const data: PhotographyData = validatePhotography(
    JSON.parse(await fs.readFile(manifestPath, "utf8")),
  );
  await fs.mkdir(staging, { recursive: true });
  async function safeFile(root: string, relative: string) {
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes(".."))
      throw new Error(`Unsafe media path: ${relative}`);
    const file = await fs.realpath(path.join(root, relative));
    if (!file.startsWith(root + path.sep))
      throw new Error(`Media path escapes input directory: ${relative}`);
    return file;
  }
  if (command === "prepare") {
    for (const photo of data.photos) {
      if (!photo.publishApproved || !photo.rights.permissionConfirmed) continue;
      const input = await safeFile(source, photo.sourcePath);
      const output = path.join(staging, `${photo.id}.webp`);
      const result = await sharp(input)
        .rotate()
        .toColourspace("srgb")
        .resize({
          width: 2400,
          height: 2400,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 88 })
        .toFile(output);
      photo.image = {
        src: `/photography/media/${photo.id}.webp`,
        width: result.width,
        height: result.height,
      };
      const bytes = await fs.readFile(output);
      await fs.writeFile(
        output + ".sha256",
        createHash("sha256").update(bytes).digest("hex"),
      );
    }
    await fs.writeFile(
      path.join(staging, "prepared-manifest.json"),
      JSON.stringify(data, null, 2) + "\n",
    );
    console.log(
      "Prepared approved derivatives and prepared-manifest.json for review.",
    );
  } else {
    const projection = getPublicPhotography(data);
    const target = path.join(app, "public/photography/media"),
      fresh = await fs.mkdtemp(path.join(app, ".media-publish-"));
    try {
      for (const photo of projection.albums.flatMap((a) => a.photos)) {
        const name = path.basename(photo.image.src);
        const file = await safeFile(staging, name);
        const bytes = await fs.readFile(file),
          hash = await fs.readFile(file + ".sha256", "utf8");
        if (createHash("sha256").update(bytes).digest("hex") !== hash)
          throw new Error(`Checksum mismatch: ${name}`);
        const meta = await sharp(bytes).metadata();
        if (meta.exif || meta.xmp || meta.iptc || meta.icc)
          throw new Error(`Embedded metadata in ${name}`);
        if (
          meta.width !== photo.image.width ||
          meta.height !== photo.image.height
        )
          throw new Error(`Dimension mismatch: ${name}`);
        await fs.writeFile(path.join(fresh, name), bytes);
      }
      const manifest = path.join(
        app,
        "src/content-data/photography-public.json",
      );
      await fs.writeFile(
        manifest + ".pending",
        JSON.stringify(projection, null, 2) + "\n",
      );
      const backup = target + ".previous";
      await fs.rm(backup, { recursive: true, force: true });
      try {
        await fs.rename(target, backup);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      try {
        await fs.rename(fresh, target);
        await fs.rename(manifest + ".pending", manifest);
      } catch (e) {
        await fs.rm(target, { recursive: true, force: true });
        try {
          await fs.rename(backup, target);
        } catch (restoreError) {
          if ((restoreError as NodeJS.ErrnoException).code !== "ENOENT")
            throw new AggregateError(
              [e, restoreError],
              "Publication failed and the media backup could not be restored.",
            );
        }
        throw e;
      }
      await fs.rm(backup, { recursive: true, force: true });
      console.log(
        `Published ${projection.summary.albumCount} albums and ${projection.summary.photoCount} photographs.`,
      );
    } finally {
      await fs.rm(fresh, { recursive: true, force: true });
    }
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
