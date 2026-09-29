export type * from "./atlas-vendor/site-types";
import type { AtlasSiteBundle as Version10 } from "./atlas-vendor/site-types";
import type { AtlasSiteBundle as Version11 } from "./atlas-vendor/1.1/site-types";
import type { AtlasSiteBundle as Version12 } from "./atlas-vendor/1.2/site-types";
import type { AtlasSiteBundle as Version13 } from "./atlas-vendor/1.3/site-types";
import type { AtlasSiteBundle as Version14 } from "./atlas-vendor/1.4/site-types";
import type { AtlasSiteBundle as Version15, AtlasSelectedOneHealth as Health15 } from "./atlas-vendor/1.5/site-types";
import type { AtlasSelectedOneHealth as Health14 } from "./atlas-vendor/1.4/site-types";
export type AtlasSiteBundle = Version10 | Version11 | Version12 | Version13 | Version14 | Version15;
export type AtlasSelectedOneHealth = Health14 | Health15;
export type { AtlasObservationTime, AtlasOneHealthPanelReview, AtlasOneHealthTiming, AtlasOneHealthSamplingAssessment, AtlasOneHealthContext, AtlasSelectedOneHealthPanel } from "./atlas-vendor/1.5/site-types";
export type { AtlasOneHealthNode, AtlasOneHealthRelation, AtlasOneHealthOptions, AtlasOneHealthDomain, AtlasDiseaseComposition } from "./atlas-vendor/1.4/site-types";
export type { AtlasSelectedChain, AtlasChainNode, AtlasChainEdge, AtlasChainKind } from "./atlas-vendor/1.2/site-types";
export type { AtlasReviewedSeries } from "./atlas-vendor/1.1/site-types";

export const reviewedSelectorSha256 = "4b8594136d1fcfba5639851bebe21738772106138a0712897c3c76a69652179d";

export const chainSelectorSha256 = "f448a013bfb4d45f2f34d4e07f64d164be830d19450690d022bcda38185d60a4";

export const selectorHashes = { "1.0.0": "5377beb11a2cf9885d9d55a1783c0cad0d305fc47323e61fccb24e4de197d3c4", "1.1.0": reviewedSelectorSha256, "1.2.0": chainSelectorSha256,
  "1.3.0": "c5a79e4cb39e12bf5317b8a34f0403264b6f7bf6e7bae62b4ac44fe0bf1f3356", "1.4.0": "5786eb97ab1eb242ddd805699498ad9d1ff588358274f9601c91ba9af286167b", "1.5.0": "80f15b7fda19c2fd1aed5d92a6317733fe5b69aa66c5fa0e386b403a61b21e0c" };
