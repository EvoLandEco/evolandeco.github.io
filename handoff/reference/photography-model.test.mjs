import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const [compiledModel, fixturePath, seedPath] = process.argv.slice(2);
if (!compiledModel || !fixturePath || !seedPath) {
  throw new Error("Pass the compiled model path, fixture JSON path and production seed path.");
}
const { validatePhotography, getPublicPhotography } = createRequire(import.meta.url)(compiledModel);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const checks = [];

function check(name, run) {
  try {
    run();
    checks.push({ name, passed: true });
  } catch (error) {
    checks.push({ name, passed: false, detail: String(error) });
  }
}
function mutated(change) {
  const data = structuredClone(fixture);
  change(data);
  return data;
}
function rejects(name, change, expected) {
  check(name, () => assert.throws(() => validatePhotography(mutated(change), "test"), expected));
}

check("Empty owner seed has no numerical travel claim", () => {
  const p = getPublicPhotography(seed);
  assert.equal(p.summary.countryCount, null);
  assert.equal(p.summary.countryLabel, null);
  assert.equal(p.summary.albumCount, 0);
  assert.equal(p.summary.photoCount, 0);
  assert.deepEqual(p.countries, []);
});
check("Production rejects synthetic fixture content", () => assert.throws(() => getPublicPhotography(fixture), /fixtureOnly/));
check("Fixture has three documented countries, two albums and three photos", () => {
  assert.deepEqual(getPublicPhotography(fixture, "test").summary, {
    countryCount: 3, countryLabel: "countries documented", albumCount: 2, photoCount: 3,
  });
});
check("Missing marker coordinates never lower the country total", () => {
  const p = getPublicPhotography(mutated(d => d.countries.forEach(c => { c.mapMarker = null; })), "test");
  assert.equal(p.summary.countryCount, 3);
  assert.ok(p.countries.every(c => c.mapMarker === null));
});
check("Visited country without published album is represented without a dead link", () => {
  const c = getPublicPhotography(fixture, "test").countries.find(c => c.code === "FR");
  assert.ok(c);
  assert.equal(c.albumHref, null);
});
check("Private and unconfirmed countries are absent from public selectors", () => {
  const p = getPublicPhotography(fixture, "test");
  assert.deepEqual(p.countries.map(c => c.code).sort(), ["FR", "JP", "NL"]);
  assert.ok(!JSON.stringify(p).includes("fixture-be-private"));
  assert.ok(!JSON.stringify(p).includes("Germany"));
});
check("Private fields are not spread into public records", () => {
  const serialized = JSON.stringify(getPublicPhotography(fixture, "test"));
  for (const value of ["sourcePath", "media-private/", "visitConfirmed", "fixtureOnly", "publishApproved", "permissionConfirmed", "fixture-nl-draft"]) {
    assert.ok(!serialized.includes(value), value);
  }
});
check("Photo order and full-photo URLs match the country album", () => {
  const album = getPublicPhotography(fixture, "test").albums.find(a => a.countryCode === "NL");
  assert.deepEqual(album.photos.map(p => p.id), ["fixture-nl-landscape", "fixture-nl-portrait"]);
  assert.equal(album.photos[0].href, "/photography/netherlands/fixture-nl-landscape");
});
check("Portrait and panorama dimensions are preserved", () => {
  const photos = getPublicPhotography(fixture, "test").albums.flatMap(a => a.photos);
  assert.deepEqual(photos.find(p => p.id === "fixture-nl-portrait").image, {
    src: "/photography/media/fixture-nl-portrait.webp", width: 1000, height: 1500,
  });
  assert.equal(photos.find(p => p.id === "fixture-jp-panorama").image.width, 2400);
});
check("Adding photos from another visit does not increase the country total", () => {
  const data = mutated(d => {
    const photo = structuredClone(d.photos[0]);
    photo.id = "fixture-nl-another-visit";
    photo.sourcePath = "media-private/fixture-nl-another-visit.png";
    photo.image.src = "/photography/media/fixture-nl-another-visit.webp";
    d.photos.push(photo);
    d.albums[0].photoOrder.push(photo.id);
  });
  const p = getPublicPhotography(data, "test");
  assert.equal(p.summary.countryCount, 3);
  assert.equal(p.summary.photoCount, 4);
});
check("Hiding an album leaves its confirmed country in the total", () => {
  const p = getPublicPhotography(mutated(d => { d.albums[0].status = "draft"; }), "test");
  assert.equal(p.summary.countryCount, 3);
  assert.equal(p.summary.albumCount, 1);
  assert.equal(p.summary.photoCount, 1);
  assert.equal(p.countries.find(c => c.code === "NL").albumHref, null);
});
check("Hiding a country also removes its albums and images", () => {
  const p = getPublicPhotography(mutated(d => { d.countries[0].visibility = "private"; }), "test");
  assert.equal(p.summary.countryCount, 2);
  assert.equal(p.summary.albumCount, 1);
  assert.ok(!JSON.stringify(p).includes("fixture-nl-landscape"));
});
check("A confirmed complete empty list can represent zero visits", () => {
  const data = structuredClone(seed);
  data.travelLogStatus = "complete";
  assert.equal(getPublicPhotography(data).summary.countryCount, 0);
  assert.equal(getPublicPhotography(data).summary.countryLabel, "countries visited");
});
check("A complete public list uses countries visited", () => {
  const data = mutated(d => {
    d.countries = d.countries.filter(c => c.visibility === "public");
    d.albums = d.albums.filter(a => a.countryCode !== "BE");
    d.photos = d.photos.filter(p => p.albumId !== "album-be");
    d.travelLogStatus = "complete";
  });
  assert.equal(getPublicPhotography(data, "test").summary.countryLabel, "countries visited");
});
check("Selectors do not mutate source data", () => {
  const before = JSON.stringify(fixture);
  getPublicPhotography(fixture, "test");
  assert.equal(JSON.stringify(fixture), before);
});
check("Valid leap-day dates are accepted", () => validatePhotography(mutated(d => { d.photos[0].takenOn = "2024-02-29"; }), "test"));

rejects("Complete list cannot conceal confirmed private visits", d => { d.travelLogStatus = "complete"; }, /use partial/);
rejects("Duplicate country codes are rejected", d => d.countries.push(structuredClone(d.countries[0])), /countries.code/);
rejects("Duplicate country slugs are rejected", d => { d.countries[1].slug = d.countries[0].slug; }, /countries.slug/);
rejects("More than one album for a country is rejected", d => d.albums.push({ ...d.albums[0], id: "second-nl-album" }), /albums.countryCode/);
rejects("Duplicate photo IDs are rejected", d => d.photos.push(structuredClone(d.photos[0])), /photos.id/);
rejects("Unknown country relations are rejected", d => { d.albums[0].countryCode = "ZZ"; }, /country does not exist/);
rejects("Unknown album relations are rejected", d => { d.photos[0].albumId = "missing-album"; }, /album does not exist/);
rejects("Incomplete photo order is rejected", d => d.albums[0].photoOrder.pop(), /photoOrder/);
rejects("Duplicate photo order is rejected", d => d.albums[0].photoOrder.push(d.albums[0].photoOrder[0]), /photoOrder/);
rejects("Foreign cover photo is rejected", d => { d.albums[0].coverPhotoId = "fixture-jp-panorama"; }, /cover is not/);
rejects("Draft cover cannot represent a published album", d => { d.albums[0].coverPhotoId = "fixture-nl-draft"; }, /published cover/);
rejects("Empty draft cannot be published without a cover", d => { d.albums[2].status = "published"; }, /published cover/);
rejects("Unconfirmed country cannot have a published album", d => { d.countries[0].visitConfirmed = false; }, /confirm the country/);
rejects("Published photograph requires approval", d => { d.photos[0].publishApproved = false; }, /approval/);
rejects("Published photograph requires permission", d => { d.photos[0].rights.permissionConfirmed = false; }, /permission/);
rejects("Published photograph requires alt text", d => { d.photos[0].alt = " "; }, /alt/);
rejects("Published photograph requires a derivative", d => { d.photos[0].image = null; }, /derivative/);
rejects("Invalid map latitude is rejected", d => { d.countries[0].mapMarker.lat = 91; }, /coordinate/);
rejects("NaN map longitude is rejected", d => { d.countries[0].mapMarker.lng = NaN; }, /coordinate/);
rejects("Nonpositive image dimensions are rejected", d => { d.photos[0].image.width = 0; }, /dimension/);
rejects("Fractional image dimensions are rejected", d => { d.photos[0].image.height = 5.5; }, /dimension/);
rejects("External image paths are rejected", d => { d.photos[0].image.src = "https://example.com/unknown.jpg"; }, /derivative path/);
rejects("Source path traversal is rejected", d => { d.photos[0].sourcePath = "media-private/../secret.jpg"; }, /safe relative path/);
rejects("Invalid calendar date is rejected", d => { d.photos[0].takenOn = "2025-02-29"; }, /calendar date/);
rejects("Unknown root fields are rejected", d => { d.secret = "not public"; }, /unexpected field/);
rejects("Wrong schema version is rejected", d => { d.schemaVersion = 2; }, /schemaVersion/);

const result = {
  scope: "Executable photography reference model; no website, image pipeline or browser tests",
  passed: checks.every(c => c.passed),
  checks,
};
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.passed ? 0 : 1;
