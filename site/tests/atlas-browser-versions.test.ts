import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { TABLES as tables03 } from "../src/lib/atlas-vendor/browser/0.3/browser_tables.js";
import { decodeBrowserCore, type AtlasBrowserCore } from "../src/lib/atlas-browser";
import { browserSelectorHashes } from "../src/lib/atlas-release";
import { metricValue } from "../src/lib/atlas-metrics";
import { healthPanelsFixture } from "./atlas-health-panels-fixture";

test("Current browser decoder preserves qualifiers and rejects older transports", () => {
  const source = healthPanelsFixture(), exportId = "a".repeat(64);
  for (const version of ["0.3.0"] as const) {
    const specs = tables03;
    const strings: string[] = [];
    const text = (value: unknown) => { assert.equal(typeof value, "string"); strings.push(String(value)); return strings.length - 1; };
    const intern = (value: unknown) => { const index = strings.indexOf(String(value)); return index < 0 ? text(value) : index; };
    const tables = Object.fromEntries(Object.entries(specs).map(([name, spec]) => [name, { ...spec, rows: [] as unknown[][] }]));
    for (const qualifier of ["more_than", "less_than", "at_least", "at_most"]) {
      const measure: Record<string, unknown> = { ...source.metrics.measures[0], measure_id: qualifier, qualifier, value: 10, unit: "people", source_record_id: source.records[0].id, evidence_record_ids: [source.records[0].id], compact_figure_id: null };
      const spec = specs["metrics.measures"];
      tables["metrics.measures"].rows.push(spec.columns.map((key, i) => {
        const value = measure[key];
        return value === null ? null : spec.encoding[i] === "string" ? intern(value) : spec.encoding[i] === "strings" ? (value as string[]).map(intern) : value;
      }));
    }
    const core = { transport_version: version, source_export_id: exportId, strings, eligibility_record_sets: [], tables,
      metadata: { contract_version: source.contract_version, snapshot: source.snapshot, reviewed_chains: [], metrics: { contract_version: source.metrics.contract_version, coverage: source.metrics.coverage } } } as AtlasBrowserCore;
    const decoded = decodeBrowserCore(core, exportId);
    assert.deepEqual(decoded.metrics.measures.map(metricValue), [">10", "<10", "≥10", "≤10"]);
    const wrongVersion = structuredClone(core);
    Object.assign(wrongVersion, { transport_version: "0.2.0" });
    assert.throws(() => decodeBrowserCore(wrongVersion, exportId), /version or source mismatch/);
    for (const [name, expected] of Object.entries(browserSelectorHashes[version])) {
      const bytes = readFileSync(new URL(`../src/lib/atlas-vendor/browser/0.3/${name}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), expected);
    }
  }
});
