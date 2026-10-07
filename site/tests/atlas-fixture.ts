import { readFileSync } from "node:fs";
import { createAtlasStore } from "../src/lib/atlas-store";
import type { AtlasMapSnapshot, AtlasSiteBundle } from "../src/lib/atlas-contract";
const source = JSON.parse(readFileSync(".cache/atlas-fixture/atlas-site.json", "utf8"));
export const bundle: AtlasSiteBundle = { ...source, contract_version: "1.8.0",
  metrics: { ...source.metrics, contract_version: "0.4.0", reviewed_series: [] },
  reviewed_chains: [], diseases: [], disease_reviews: [], report_assessments: [],
  one_health_reviews: [], one_health_nodes: [], one_health_relations: [],
  one_health_timings: [], one_health_sampling_assessments: [], one_health_contexts: [] };

const snapshot: AtlasMapSnapshot = JSON.parse(readFileSync(".cache/atlas-fixture/map.json", "utf8"));
export const { atlas, atlasDocuments, mappedTracks, mapLocations, dateBounds, windowRecords, reportDocuments, reportOrganizations, trackCountries, countriesForReports, countriesForLocations, countriesForLink, metrics, measures, panelMeasures, compactPanelFigures, assertions, reportComparisons } = createAtlasStore(snapshot, bundle);
