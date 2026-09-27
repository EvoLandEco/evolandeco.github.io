import { readFileSync } from "node:fs";
import { createAtlasStore } from "../src/lib/atlas-store";
import type { AtlasMapSnapshot, AtlasSiteBundle } from "../src/lib/atlas-vendor/site-types";
export const bundle: AtlasSiteBundle = JSON.parse(readFileSync(".cache/atlas-fixture/atlas-site.json", "utf8"));
const snapshot: AtlasMapSnapshot = JSON.parse(readFileSync(".cache/atlas-fixture/map.json", "utf8"));
export const { atlas, atlasDocuments, mappedTracks, mapLocations, dateBounds, windowRecords, reportDocuments, reportOrganizations, trackCountries, countriesForReports, countriesForLocations, countriesForLink, metrics, measures, panelMeasures, compactPanelFigures, assertions, reportComparisons } = createAtlasStore(snapshot, bundle);
