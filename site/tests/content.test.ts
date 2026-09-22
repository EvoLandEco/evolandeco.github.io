import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import sharp from "sharp";
import {
  getPublicPhotography,
  validatePhotography,
} from "../scripts/photography-model";
import data from "../src/content-data/portfolio.json";
const fixture = JSON.parse(
  fs.readFileSync(
    "tests/fixtures/photography.json",
    "utf8",
  ),
);
test("Publication record, programme status and software roles", () => {
  assert.equal(
    data.publications.filter((p) => p.status === "peer-reviewed").length,
    8,
  );
  assert.equal(
    data.publications.filter((p) => p.status === "preprint").length,
    2,
  );
  assert.equal(
    data.programmes.find((p) => p.id === "nextdai")?.status,
    "In development",
  );
  assert.equal(
    data.software.filter((s) => s.role === "Collaborator").length,
    3,
  );
  for (const p of data.publications) {
    const citation = fs.readFileSync(`public/citations/${p.id}.bib`, "utf8");
    assert(citation.includes(p.doi));
  }
});
test("Public photo projection excludes private records and uses independent counts", () => {
  assert.throws(() => getPublicPhotography(fixture), /fixtureOnly/);
  const p = getPublicPhotography(fixture, "test");
  assert.deepEqual(p.summary, {
    countryCount: 3,
    countryLabel: "countries documented",
    albumCount: 2,
    photoCount: 3,
  });
  assert(!JSON.stringify(p).includes("sourcePath"));
  assert(!p.countries.some((c) => ["BE", "DE"].includes(c.code)));
  assert.equal(p.countries.find((c) => c.code === "FR")?.albumHref, null);
});
test("Duplicate countries, unapproved photos and invalid covers fail", () => {
  let d = structuredClone(fixture);
  d.countries.push(d.countries[0]);
  assert.throws(() => validatePhotography(d, "test"), /duplicate/);
  d = structuredClone(fixture);
  d.photos.find(
    (p: { status: string }) => p.status === "published",
  ).publishApproved = false;
  assert.throws(() => validatePhotography(d, "test"), /approval/);
  d = structuredClone(fixture);
  d.albums[0].coverPhotoId = "missing";
  assert.throws(() => validatePhotography(d, "test"), /cover/);
});
test("Empty seed has no numeric travel claim", () => {
  const p = JSON.parse(fs.readFileSync("src/content-data/photography-public.json", "utf8"));
  assert.equal(p.summary.countryCount, null);
  assert.equal(p.albums.length, 0);
});
test("Published sample derivatives carry no private image metadata", async () => {
  for (const file of fs.readdirSync("public/photography/samples")) {
    const m = await sharp("public/photography/samples/" + file).metadata();
    assert(!m.exif && !m.xmp && !m.iptc);
    assert(m.width && m.height);
  }
});
test("Media prepare, publish and hide preserve originals and remove public derivatives", async () => {
  const os = await import("node:os"),
    path = await import("node:path"),
    cp = await import("node:child_process"),
    nodeModule = await import("node:module");
  const require = nodeModule.createRequire(import.meta.url),
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tq-media-test-")),
    app = path.join(tmp, "app"),
    originals = path.join(tmp, "originals"),
    staging = path.join(tmp, "staging"),
    manifest = path.join(tmp, "manifest.json");
  for (const dir of [
    app,
    originals,
    path.join(originals, "media-private"),
    staging,
    path.join(app, "public/photography"),
    path.join(app, "src/content-data"),
  ])
    fs.mkdirSync(dir, { recursive: true });
  const image = await sharp({
    create: { width: 40, height: 60, channels: 3, background: "#315ba6" },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  fs.writeFileSync(path.join(originals, "media-private/photo.jpg"), image);
  const data = {
    schemaVersion: 1,
    fixtureOnly: false,
    title: "Photography",
    intro: "Test archive",
    travelLogStatus: "partial",
    countries: [
      {
        code: "NL",
        name: "Netherlands",
        slug: "netherlands",
        visibility: "public",
        visitConfirmed: true,
        mapMarker: null,
      },
    ],
    albums: [
      {
        id: "netherlands",
        countryCode: "NL",
        title: "Netherlands",
        description: "Test album",
        status: "draft",
        coverPhotoId: null,
        photoOrder: ["one"],
      },
    ],
    photos: [
      {
        id: "one",
        albumId: "netherlands",
        status: "draft",
        sourcePath: "media-private/photo.jpg",
        publishApproved: true,
        rights: { creator: "Test author", permissionConfirmed: true },
        alt: "A blue rectangle",
        caption: null,
        takenOn: null,
        locationLabel: null,
        image: null,
      },
    ],
  };
  fs.writeFileSync(manifest, JSON.stringify(data));
  const script = path.resolve("scripts/media.ts");
  function run(command: string, file: string) {
    return cp.spawnSync(
      process.execPath,
      [
        "--import",
        require.resolve("tsx"),
        script,
        command,
        file,
        originals,
        staging,
      ],
      { cwd: app, encoding: "utf8" },
    );
  }
  try {
    let result = run("prepare", manifest);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      fs.readFileSync(path.join(originals, "media-private/photo.jpg")),
      image,
    );
    const preparedPath = path.join(staging, "prepared-manifest.json"),
      prepared = JSON.parse(fs.readFileSync(preparedPath, "utf8"));
    assert.equal(prepared.photos[0].image.width, 60);
    assert.equal(prepared.photos[0].image.height, 40);
    assert(!fs.existsSync(path.join(app, "public/photography/media/one.webp")));
    prepared.photos[0].status = "published";
    prepared.albums[0].status = "published";
    prepared.albums[0].coverPhotoId = "one";
    fs.writeFileSync(preparedPath, JSON.stringify(prepared));
    result = run("publish", preparedPath);
    assert.equal(result.status, 0, result.stderr);
    const publicPath = path.join(app, "public/photography/media/one.webp");
    assert(fs.existsSync(publicPath));
    const meta = await sharp(publicPath).metadata();
    assert(!meta.exif && !meta.xmp && !meta.icc);
    const projection = fs.readFileSync(
      path.join(app, "src/content-data/photography-public.json"),
      "utf8",
    );
    assert(!projection.includes("sourcePath"));
    prepared.albums[0].status = "draft";
    fs.writeFileSync(preparedPath, JSON.stringify(prepared));
    result = run("publish", preparedPath);
    assert.equal(result.status, 0, result.stderr);
    assert(!fs.existsSync(publicPath));
    prepared.photos[0].sourcePath = "../manifest.json";
    fs.writeFileSync(manifest, JSON.stringify(prepared));
    assert.notEqual(run("prepare", manifest).status, 0);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
