export type * from "./atlas-vendor/site-types";
import type { AtlasSiteBundle as Version10 } from "./atlas-vendor/site-types";
import type { AtlasSiteBundle as Version11 } from "./atlas-vendor/1.1/site-types";
import type { AtlasSiteBundle as Version12 } from "./atlas-vendor/1.2/site-types";
export type AtlasSiteBundle = Version10 | Version11 | Version12;
export type { AtlasSelectedChain, AtlasChainNode, AtlasChainEdge, AtlasChainKind } from "./atlas-vendor/1.2/site-types";
export type { AtlasReviewedSeries } from "./atlas-vendor/1.1/site-types";

export const reviewedSelectorSha256 = "4b8594136d1fcfba5639851bebe21738772106138a0712897c3c76a69652179d";

export const chainSelectorSha256 = "f448a013bfb4d45f2f34d4e07f64d164be830d19450690d022bcda38185d60a4";

export const selectorHashes = { "1.0.0": "5377beb11a2cf9885d9d55a1783c0cad0d305fc47323e61fccb24e4de197d3c4", "1.1.0": reviewedSelectorSha256, "1.2.0": chainSelectorSha256 };
