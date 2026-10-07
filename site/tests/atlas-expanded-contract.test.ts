import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { healthPanelsFixture } from "./atlas-health-panels-fixture";
import { createResearch } from "../src/lib/atlas-comparisons";
import { metricValue } from "../src/lib/atlas-metrics";
import { fetchAtlasData } from "../src/lib/atlas-release";
import { atlasSelectorSha256 } from "../src/lib/atlas-contract";
import fixture from "./atlas-fixture.json";

test("Current contract retains quantity units and evidence selection", () => {
  const bundle = healthPanelsFixture();
  const schema = JSON.parse(readFileSync(new URL("../src/lib/atlas-vendor/1.7/metrics.schema.json", import.meta.url), "utf8"));
  const measureSchema = z.fromJSONSchema({ $defs: schema.$defs, $ref: "#/$defs/ExportMeasure" });
  for (const [unit, value, label] of [["percent_change", -38, "-38% change"], ["percent_of_target", 120, "120% of target"], ["percent", 0, "0%"], ["proportion", 0.5, "0.5"]] as const) {
    const measure = { ...bundle.metrics.measures[0], qualifier: "exact", unit, value };
    measureSchema.parse(measure);
    assert.equal(metricValue(measure), label);
    assert.equal(metricValue({ ...measure, value: null, value_status: "not_reported" }), "not reported");
  }
  const research = createResearch(bundle);
  assert.equal(research.selectedResearch(new Set()).record_ids.length, 0);
  const id = bundle.records[0].id;
  assert.deepEqual(research.selectedResearch(new Set([id])).record_ids, [id]);
});

test("Source quantity bounds distinguish strict, inclusive and approximate qualifiers", () => {
  for (const [qualifier, prefix] of [["more_than", ">"], ["less_than", "<"], ["at_least", "≥"], ["at_most", "≤"], ["approximately", "≈"], ["exact", ""], ["unknown", ""]]) {
    assert.equal(metricValue({ value: 10, value_status: "reported", unit: "people", qualifier }), `${prefix}10`);
  }
});

test("The UI rejects older contracts, missing transport and mismatched selectors before asset downloads", async t => {
  const current = { ...fixture.release, contract_version: "1.8.0", selector_sha256: atlasSelectorSha256,
    browser: { transport_version: "0.3.0", manifest: fixture.release.assets["atlas-site.json"] } };
  let release: unknown;
  const fetched: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => { fetched.push(url); return Response.json(release); });
  const invalid = [
    ...Array.from({ length: 8 }, (_, i) => ({ ...current, contract_version: `1.${i}.0` })),
    { ...current, browser: undefined },
    ...["0.1.0", "0.2.0"].map(version => ({ ...current, browser: { ...current.browser, transport_version: version } })),
    { ...current, selector_sha256: "0".repeat(64) },
  ];
  for (release of invalid) {
    fetched.length = 0;
    await assert.rejects(fetchAtlasData());
    assert.equal(fetched.length, 1);
    assert(fetched[0].endsWith("/current.json"));
  }
});
