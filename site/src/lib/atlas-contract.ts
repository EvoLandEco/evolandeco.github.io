export type * from "./atlas-vendor/browser/0.3/atlas.js";
import type { AtlasSiteBundle as ProducerBundle } from "./atlas-vendor/browser/0.3/atlas.js";
import type { AtlasBrowserData, AtlasBrowserMap } from "./atlas-browser";
export type AtlasSiteBundle = Omit<ProducerBundle, "contract_version"> & { contract_version: "1.8.0" };
export type AtlasData = AtlasSiteBundle | AtlasBrowserData;
export type AtlasMap = import("./atlas-vendor/browser/0.3/atlas.js").AtlasMapSnapshot | AtlasBrowserMap;
export const atlasContractVersion = "1.8.0";
export const atlasSelectorSha256 = "eeb1ed08365086de8f97a1b952405927f9948f3c61ffde538f401dab4c083136";
