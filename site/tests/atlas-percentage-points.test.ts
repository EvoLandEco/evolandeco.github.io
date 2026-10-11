import { test } from "node:test";
import assert from "node:assert/strict";
import { metricValue } from "../src/lib/atlas-metrics";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { healthPanelsFixture } from "./atlas-health-panels-fixture";
import { atlasSelectorSha256 } from "../src/lib/atlas-contract";
import { uiReleaseSchema } from "../src/lib/atlas-release";
import fixture from "./atlas-fixture.json";

test("Percentage-point differences retain signs and distinct units", () => {
  for (const [value, expected] of [[-1.5, "-1.5 pp"], [0, "0 pp"], [0.2, "+0.2 pp"], [-100, "-100 pp"], [100, "+100 pp"]] as const) {
    assert.equal(metricValue({ value, value_status: "reported", unit: "percentage_points" }), expected);
  }
  assert.equal(metricValue({ value: -1.5, value_status: "reported", unit: "percent_change" }), "-1.5% change");
  assert.equal(metricValue({ value: 1.5, value_status: "reported", unit: "percent" }), "1.5%");
  assert.equal(metricValue({ value: null, value_status: "not_reported", unit: "percentage_points" }), "not reported");
});

test("Percentage-point schemas preserve bounds and ordered comparison context", () => {
  const schema = JSON.parse(readFileSync(new URL("../src/lib/atlas-vendor/1.9/metrics.schema.json", import.meta.url), "utf8"));
  const measureSchema = z.fromJSONSchema({ $defs: schema.$defs, $ref: "#/$defs/ExportPercentagePointMeasure" });
  const measure = { ...healthPanelsFixture().metrics.measures[0], value: -1.5, unit: "percentage_points",
    percentage_point_comparison: { baseline: "Week 36", comparison: "Week 37", operation: "comparison_minus_baseline" } };
  assert.deepEqual(measureSchema.parse(measure), measure);
  for (const value of [-101, 101]) assert.throws(() => measureSchema.parse({ ...measure, value }));
  assert.throws(() => measureSchema.parse({ ...measure, percentage_point_comparison: undefined }));
  assert.throws(() => measureSchema.parse({ ...measure, percentage_point_comparison: { ...measure.percentage_point_comparison, operation: "baseline_minus_comparison" } }));
});

test("Both supported releases require their exact selector and transport pair", () => {
  const descriptor = fixture.release.assets["atlas-site.json"];
  const current = { ...fixture.release, contract_version: "1.9.0", selector_sha256: atlasSelectorSha256,
    browser: { transport_version: "0.4.0", manifest: descriptor } };
  const previous = { ...current, contract_version: "1.8.0", selector_sha256: "eeb1ed08365086de8f97a1b952405927f9948f3c61ffde538f401dab4c083136",
    browser: { transport_version: "0.3.0", manifest: descriptor } };
  uiReleaseSchema.parse(current);
  uiReleaseSchema.parse(previous);
  assert.throws(() => uiReleaseSchema.parse({ ...current, browser: previous.browser }));
  assert.throws(() => uiReleaseSchema.parse({ ...current, selector_sha256: previous.selector_sha256 }));
  assert.throws(() => uiReleaseSchema.parse({ ...previous, browser: current.browser }));
});
