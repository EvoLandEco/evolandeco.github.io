export type * from "./atlas-vendor/browser/0.4/atlas.js";
import type { AtlasSiteBundle as ProducerBundle } from "./atlas-vendor/browser/0.4/atlas.js";
import type { AtlasBrowserData, AtlasBrowserMap } from "./atlas-browser";
export type AtlasSiteBundle = Omit<ProducerBundle, "contract_version"> & { contract_version: "1.8.0" | "1.9.0" };
export type AtlasData = AtlasSiteBundle | AtlasBrowserData;
export type AtlasMap = import("./atlas-vendor/browser/0.4/atlas.js").AtlasMapSnapshot | AtlasBrowserMap;
export const atlasContractVersion = "1.9.0";
export const atlasSelectorSha256 = "bb0452225290142c59ff19ce3827bfd4a0a12fa7cd7937f60742ad09e1ad8d92";
