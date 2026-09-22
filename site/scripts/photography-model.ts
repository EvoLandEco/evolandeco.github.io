/** Photography content validation and explicit public projections. */
export type PublicationStatus = "draft" | "published";
export type TravelLogStatus = "unconfirmed" | "partial" | "complete";

export interface CountryRecord {
  code: string;
  name: string;
  slug: string;
  visibility: "public" | "private";
  visitConfirmed: boolean;
  mapMarker: { lat: number; lng: number } | null;
}

export interface AlbumRecord {
  id: string;
  countryCode: string;
  title: string;
  description: string;
  status: PublicationStatus;
  coverPhotoId: string | null;
  photoOrder: string[];
}

export interface PublicImage {
  src: string;
  width: number;
  height: number;
}

export interface PhotoRecord {
  id: string;
  albumId: string;
  status: PublicationStatus;
  sourcePath: string;
  publishApproved: boolean;
  rights: { creator: string; permissionConfirmed: boolean };
  alt: string;
  caption: string | null;
  takenOn: string | null;
  locationLabel: string | null;
  image: PublicImage | null;
}

export interface PhotographyData {
  schemaVersion: 1;
  fixtureOnly: boolean;
  title: string;
  intro: string;
  travelLogStatus: TravelLogStatus;
  countries: CountryRecord[];
  albums: AlbumRecord[];
  photos: PhotoRecord[];
}

function fail(path: string, message: string): never {
  throw new Error(`${path}: ${message}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "expected an object");
  }
  return value as Record<string, unknown>;
}

function fields(
  value: Record<string, unknown>,
  expected: string[],
  path: string,
): void {
  for (const key of expected) {
    if (!Object.prototype.hasOwnProperty.call(value, key))
      fail(`${path}.${key}`, "missing field");
  }
  for (const key of Object.keys(value)) {
    if (!expected.includes(key)) fail(`${path}.${key}`, "unexpected field");
  }
}

function text(
  value: unknown,
  path: string,
  allowEmpty = false,
): asserts value is string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    fail(path, "expected a string" + (allowEmpty ? "" : " with content"));
  }
}

function nullableText(value: unknown, path: string): void {
  if (value !== null) text(value, path);
}

function boolean(value: unknown, path: string): void {
  if (typeof value !== "boolean") fail(path, "expected a boolean");
}

function choice(value: unknown, allowed: string[], path: string): void {
  if (typeof value !== "string" || !allowed.includes(value))
    fail(path, `expected ${allowed.join(" or ")}`);
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  return value;
}

function id(value: unknown, path: string): void {
  text(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value))
    fail(path, "use a stable lowercase slug");
}

function countryCode(value: unknown, path: string): void {
  text(value, path);
  if (!/^[A-Z]{2}$/.test(value))
    fail(path, "expected an uppercase two-letter country code");
}

function coordinate(value: unknown, limit: number, path: string): void {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    Math.abs(value) > limit
  ) {
    fail(path, `expected a finite coordinate between ${-limit} and ${limit}`);
  }
}

function dimension(value: unknown, path: string): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    fail(path, "expected a positive integer dimension");
  }
}

function date(value: unknown, path: string): void {
  if (value === null) return;
  text(value, path);
  if (!/^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(value))
    fail(path, "use YYYY, YYYY-MM or YYYY-MM-DD");
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || year > 9999)
    fail(path, "year is outside the supported range");
  if (month !== undefined && (month < 1 || month > 12))
    fail(path, "invalid month");
  if (day !== undefined) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > days[month - 1]) fail(path, "invalid calendar date");
  }
}

function assertShape(value: unknown): asserts value is PhotographyData {
  const root = object(value, "photography");
  fields(
    root,
    [
      "schemaVersion",
      "fixtureOnly",
      "title",
      "intro",
      "travelLogStatus",
      "countries",
      "albums",
      "photos",
    ],
    "photography",
  );
  if (root.schemaVersion !== 1) fail("schemaVersion", "expected version 1");
  boolean(root.fixtureOnly, "fixtureOnly");
  text(root.title, "title");
  text(root.intro, "intro", true);
  choice(
    root.travelLogStatus,
    ["unconfirmed", "partial", "complete"],
    "travelLogStatus",
  );

  list(root.countries, "countries").forEach((entry, index) => {
    const path = `countries[${index}]`;
    const row = object(entry, path);
    fields(
      row,
      ["code", "name", "slug", "visibility", "visitConfirmed", "mapMarker"],
      path,
    );
    countryCode(row.code, `${path}.code`);
    text(row.name, `${path}.name`);
    id(row.slug, `${path}.slug`);
    if (row.slug === "media")
      fail(`${path}.slug`, "media is reserved for public image assets");
    choice(row.visibility, ["public", "private"], `${path}.visibility`);
    boolean(row.visitConfirmed, `${path}.visitConfirmed`);
    if (row.mapMarker !== null) {
      const marker = object(row.mapMarker, `${path}.mapMarker`);
      fields(marker, ["lat", "lng"], `${path}.mapMarker`);
      coordinate(marker.lat, 90, `${path}.mapMarker.lat`);
      coordinate(marker.lng, 180, `${path}.mapMarker.lng`);
    }
  });

  list(root.albums, "albums").forEach((entry, index) => {
    const path = `albums[${index}]`;
    const row = object(entry, path);
    fields(
      row,
      [
        "id",
        "countryCode",
        "title",
        "description",
        "status",
        "coverPhotoId",
        "photoOrder",
      ],
      path,
    );
    id(row.id, `${path}.id`);
    countryCode(row.countryCode, `${path}.countryCode`);
    text(row.title, `${path}.title`);
    text(row.description, `${path}.description`, true);
    choice(row.status, ["draft", "published"], `${path}.status`);
    if (row.coverPhotoId !== null) id(row.coverPhotoId, `${path}.coverPhotoId`);
    list(row.photoOrder, `${path}.photoOrder`).forEach((key, i) =>
      id(key, `${path}.photoOrder[${i}]`),
    );
  });

  list(root.photos, "photos").forEach((entry, index) => {
    const path = `photos[${index}]`;
    const row = object(entry, path);
    fields(
      row,
      [
        "id",
        "albumId",
        "status",
        "sourcePath",
        "publishApproved",
        "rights",
        "alt",
        "caption",
        "takenOn",
        "locationLabel",
        "image",
      ],
      path,
    );
    id(row.id, `${path}.id`);
    id(row.albumId, `${path}.albumId`);
    choice(row.status, ["draft", "published"], `${path}.status`);
    text(row.sourcePath, `${path}.sourcePath`);
    if (
      !row.sourcePath.startsWith("media-private/") ||
      /[\\\u0000]/.test(row.sourcePath) ||
      row.sourcePath
        .split("/")
        .some((part) => part === ".." || part === "." || part === "")
    ) {
      fail(
        `${path}.sourcePath`,
        "expected a safe relative path under media-private/",
      );
    }
    boolean(row.publishApproved, `${path}.publishApproved`);
    const rights = object(row.rights, `${path}.rights`);
    fields(rights, ["creator", "permissionConfirmed"], `${path}.rights`);
    text(rights.creator, `${path}.rights.creator`);
    boolean(rights.permissionConfirmed, `${path}.rights.permissionConfirmed`);
    text(row.alt, `${path}.alt`, true);
    nullableText(row.caption, `${path}.caption`);
    nullableText(row.locationLabel, `${path}.locationLabel`);
    date(row.takenOn, `${path}.takenOn`);
    if (row.image !== null) {
      const image = object(row.image, `${path}.image`);
      fields(image, ["src", "width", "height"], `${path}.image`);
      text(image.src, `${path}.image.src`);
      if (
        !/^\/photography\/media\/[a-z0-9/-]+\.(webp|avif|jpg|png)$/.test(
          image.src,
        )
      ) {
        fail(
          `${path}.image.src`,
          "expected a local photography derivative path",
        );
      }
      dimension(image.width, `${path}.image.width`);
      dimension(image.height, `${path}.image.height`);
    }
  });
}

function unique(values: string[], path: string): void {
  if (new Set(values).size !== values.length)
    fail(path, "duplicate identifier");
}

/** Validate owner data before generating public routes or media. */
export function validatePhotography(
  value: unknown,
  mode: "production" | "test" = "production",
): PhotographyData {
  assertShape(value);
  if (value.fixtureOnly && mode !== "test")
    fail("fixtureOnly", "synthetic content is prohibited in production");
  unique(
    value.countries.map((c) => c.code),
    "countries.code",
  );
  unique(
    value.countries.map((c) => c.slug),
    "countries.slug",
  );
  unique(
    value.albums.map((a) => a.id),
    "albums.id",
  );
  unique(
    value.albums.map((a) => a.countryCode),
    "albums.countryCode",
  );
  unique(
    value.photos.map((p) => p.id),
    "photos.id",
  );
  unique(
    value.photos.flatMap((p) => (p.image === null ? [] : [p.image.src])),
    "photos.image.src",
  );
  if (
    value.travelLogStatus === "complete" &&
    value.countries.some((c) => c.visitConfirmed && c.visibility === "private")
  ) {
    fail(
      "travelLogStatus",
      "use partial when confirmed countries are omitted from public counts",
    );
  }

  const countries = new Map(value.countries.map((c) => [c.code, c]));
  const albums = new Map(value.albums.map((a) => [a.id, a]));
  const photos = new Map(value.photos.map((p) => [p.id, p]));
  for (const photo of value.photos) {
    if (!albums.has(photo.albumId))
      fail(`photos.${photo.id}.albumId`, "album does not exist");
    if (photo.status === "published") {
      if (!photo.publishApproved || !photo.rights.permissionConfirmed)
        fail(
          `photos.${photo.id}`,
          "published image requires owner approval and permission",
        );
      if (photo.image === null)
        fail(
          `photos.${photo.id}.image`,
          "published image requires a derivative",
        );
      if (!photo.alt.trim())
        fail(
          `photos.${photo.id}.alt`,
          "published image requires descriptive alt text",
        );
    }
  }
  for (const album of value.albums) {
    const country = countries.get(album.countryCode);
    if (!country)
      fail(`albums.${album.id}.countryCode`, "country does not exist");
    unique(album.photoOrder, `albums.${album.id}.photoOrder`);
    const ownPhotos = value.photos.filter((p) => p.albumId === album.id);
    if (
      album.photoOrder.length !== ownPhotos.length ||
      ownPhotos.some((p) => !album.photoOrder.includes(p.id))
    ) {
      fail(
        `albums.${album.id}.photoOrder`,
        "must list every photo in this album exactly once",
      );
    }
    for (const key of album.photoOrder) {
      if (photos.get(key)?.albumId !== album.id)
        fail(
          `albums.${album.id}.photoOrder`,
          "contains a foreign or unknown photo",
        );
    }
    if (
      album.coverPhotoId !== null &&
      photos.get(album.coverPhotoId)?.albumId !== album.id
    ) {
      fail(
        `albums.${album.id}.coverPhotoId`,
        "cover is not a photo in this album",
      );
    }
    if (album.status === "published") {
      if (!country.visitConfirmed)
        fail(
          `albums.${album.id}`,
          "confirm the country visit before publishing its album",
        );
      if (
        album.coverPhotoId === null ||
        photos.get(album.coverPhotoId)?.status !== "published"
      ) {
        fail(
          `albums.${album.id}.coverPhotoId`,
          "published album requires a published cover",
        );
      }
      if (!ownPhotos.some((p) => p.status === "published"))
        fail(
          `albums.${album.id}`,
          "published album needs a published photograph",
        );
    }
  }
  return value;
}

export interface PublicPhoto {
  id: string;
  href: string;
  alt: string;
  caption: string | null;
  takenOn: string | null;
  locationLabel: string | null;
  creator: string;
  image: PublicImage;
}

export interface PublicAlbum {
  id: string;
  countryCode: string;
  countryName: string;
  countrySlug: string;
  href: string;
  title: string;
  description: string;
  cover: PublicPhoto;
  photos: PublicPhoto[];
}

export interface PublicPhotography {
  title: string;
  intro: string;
  summary: {
    countryCount: number | null;
    countryLabel: "countries visited" | "countries documented" | null;
    albumCount: number;
    photoCount: number;
  };
  countries: {
    code: string;
    name: string;
    mapMarker: { lat: number; lng: number } | null;
    albumHref: string | null;
  }[];
  albums: PublicAlbum[];
}

/** Build a client-safe allowlist. Source paths and hidden records stay private. */
export function getPublicPhotography(
  value: unknown,
  mode: "production" | "test" = "production",
): PublicPhotography {
  const data = validatePhotography(value, mode);
  const publicCountries = data.countries
    .filter((c) => c.visibility === "public" && c.visitConfirmed)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const eligibleCodes = new Set(publicCountries.map((c) => c.code));
  const countriesByCode = new Map(publicCountries.map((c) => [c.code, c]));
  const photosById = new Map(data.photos.map((p) => [p.id, p]));
  const albums: PublicAlbum[] = [];

  for (const album of data.albums) {
    if (album.status !== "published" || !eligibleCodes.has(album.countryCode))
      continue;
    const country = countriesByCode.get(album.countryCode);
    if (!country)
      fail(`albums.${album.id}`, "public country relation is missing");
    const href = `/photography/${country.slug}`;
    const publicPhotos: PublicPhoto[] = [];
    for (const photoId of album.photoOrder) {
      const photo = photosById.get(photoId);
      if (!photo) fail(`albums.${album.id}`, "photo relation is missing");
      if (photo.status !== "published") continue;
      if (photo.image === null)
        fail(`photos.${photo.id}`, "published derivative is missing");
      publicPhotos.push({
        id: photo.id,
        href: `${href}/${photo.id}`,
        alt: photo.alt,
        caption: photo.caption,
        takenOn: photo.takenOn,
        locationLabel: photo.locationLabel,
        creator: photo.rights.creator,
        image: {
          src: photo.image.src,
          width: photo.image.width,
          height: photo.image.height,
        },
      });
    }
    const cover = publicPhotos.find((p) => p.id === album.coverPhotoId);
    if (!cover) fail(`albums.${album.id}`, "public cover relation is missing");
    albums.push({
      id: album.id,
      countryCode: country.code,
      countryName: country.name,
      countrySlug: country.slug,
      href,
      title: album.title,
      description: album.description,
      cover,
      photos: publicPhotos,
    });
  }
  albums.sort((a, b) => a.countryName.localeCompare(b.countryName, "en"));
  const albumByCode = new Map(albums.map((a) => [a.countryCode, a]));
  return {
    title: data.title,
    intro: data.intro,
    summary: {
      countryCount:
        data.travelLogStatus === "unconfirmed" ? null : publicCountries.length,
      countryLabel:
        data.travelLogStatus === "unconfirmed"
          ? null
          : data.travelLogStatus === "complete"
            ? "countries visited"
            : "countries documented",
      albumCount: albums.length,
      photoCount: albums.reduce(
        (total, album) => total + album.photos.length,
        0,
      ),
    },
    countries: publicCountries.map((country) => ({
      code: country.code,
      name: country.name,
      mapMarker:
        country.mapMarker === null
          ? null
          : { lat: country.mapMarker.lat, lng: country.mapMarker.lng },
      albumHref: albumByCode.get(country.code)?.href ?? null,
    })),
    albums,
  };
}
