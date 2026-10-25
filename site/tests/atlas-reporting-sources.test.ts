import { test } from "node:test";
import assert from "node:assert/strict";
import { createReportingSources } from "../src/lib/atlas-reporting-sources";
import { dailySelection } from "../src/lib/atlas-daily";
import { dailyFixture } from "./atlas-daily-fixture";
import type { AtlasRelease } from "../src/lib/atlas-release";

const channels = [
  { id: "ecdc_news", acquisition_source: "ecdc_news", snapshot_source: "ECDC_NEWS" },
  { id: "who-don", acquisition_source: "who_don", snapshot_source: "WHO_DON" },
];
const labels = { ECDC_NEWS: "ECDC news", WHO_DON: "WHO · DON" };
const label = (id: string) => labels[id as keyof typeof labels];
const release = { export_id: "a".repeat(64), assets: { "atlas-site.json": { sha256: "b".repeat(64), bytes: 1 }, "map.json": { sha256: "c".repeat(64), bytes: 1 } } } as AtlasRelease;

test("A collected channel has one source choice across scientific and daily reports", () => {
  const sources = createReportingSources(channels, ["ECDC_NEWS", "ECDC_NEWS", "WHO_DON"], [{ source_id: "ecdc_news", source_name: "ECDC news", documents: 2 }], label);
  assert.deepEqual(sources.choices, [{ value: "ECDC_NEWS", label: "ECDC news" }, { value: "WHO_DON", label: "WHO · DON" }]);
  assert.deepEqual(sources.dailySources(["ECDC_NEWS"]), ["ecdc_news"]);
});

test("Source mappings retain watch support, multiple selections and date limits", () => {
  const data = dailyFixture(release);
  data.documents[0].source_id = "ecdc_news"; data.documents[0].channel_id = "ecdc_news";
  data.documents[1].source_id = "independent_feed";
  const coverage = [{ source_id: "ecdc_news", source_name: "ECDC news", documents: 1 }, { source_id: "independent_feed", source_name: "Independent feed", documents: 1 }];
  const sources = createReportingSources(channels, ["ECDC_NEWS"], coverage, label);
  const select = (selected: string[], window: [string, string] = ["2026-10-01", "2026-10-07"]) => dailySelection(data, window, sources.dailySources(selected), [], data.generated_at);
  assert.deepEqual(select(["ECDC_NEWS"]).documents.map(d => d.id), ["daily_doc"]);
  assert.equal(select(["ECDC_NEWS"]).watch_items.length, 1);
  assert.deepEqual(select(["independent_feed"]).documents.map(d => d.id), ["daily_latest"]);
  assert.equal(select(["independent_feed"]).watch_items.length, 0);
  assert.equal(select(["ECDC_NEWS", "independent_feed"]).documents.length, 2);
  assert.equal(select([]).documents.length, 2);
  assert.equal(select(["ECDC_NEWS"], ["2026-10-01", "2026-10-06"]).documents.length, 0);
  assert.equal(select(["missing"]).documents.length, 0);
});

test("Channel identities determine membership independently of labels and letter case", () => {
  const sources = createReportingSources(channels, ["ECDC_NEWS", "WHO_DON"], [{ source_id: "who_don", source_name: "Shared label", documents: 2 }], () => "Shared label");
  assert.equal(sources.choices.length, 2);
  assert.deepEqual(sources.dailySources(["ECDC_NEWS", "WHO_DON"]), ["ecdc_news", "who_don"]);
  assert.deepEqual(sources.dailySources(["ecdc_NEWS"]), ["ecdc_NEWS"]);
});

test("Coverage without a registered channel remains selectable", () => {
  const sources = createReportingSources(channels, ["WHO_DON"], [{ source_id: "new_feed", source_name: "New feed", documents: 1 }, { source_id: "empty_feed", source_name: "Empty feed", documents: 0 }], label);
  assert.deepEqual(sources.choices, [{ value: "new_feed", label: "New feed" }, { value: "WHO_DON", label: "WHO · DON" }]);
  assert.deepEqual(sources.dailySources(["new_feed", "WHO_DON"]), ["new_feed", "who_don"]);
});
