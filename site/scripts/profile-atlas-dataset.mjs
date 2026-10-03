import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { ...Object.fromEntries(["bundle", "map", "release", "out"].map(name => [name, { type: "string" }])), "display-core": { type: "boolean" } } });
for (const key of ["bundle", "map", "release", "out"]) assert(values[key], `--${key} is required`);
const release = JSON.parse(await readFile(values.release, "utf8"));
const bytes = value => Buffer.byteLength(JSON.stringify(value));
const hash = value => createHash("sha256").update(value).digest("hex");
async function load(path, name) {
  const input = await readFile(path);
  assert.equal(input.length, release.assets[name].bytes);
  assert.equal(hash(input), release.assets[name].sha256);
  return JSON.parse(input);
}
const bundle = await load(values.bundle, "atlas-site.json");
const map = await load(values.map, "map.json");
assert.equal(bundle.snapshot.source_snapshot_sha256, release.assets["map.json"].sha256);
const pick = (row, fields) => Object.fromEntries(fields.split(" ").map(key => {
  assert(Object.hasOwn(row, key), `Missing ${key}`);
  return [key, row[key]];
}));
const collection = rows => ({ count: rows.length, compact_bytes: bytes(rows) });
function fields(rows) {
  const result = {};
  for (const row of rows) for (const [key, value] of Object.entries(row)) {
    result[key] ??= { count: 0, value_bytes: 0 };
    result[key].count++;
    result[key].value_bytes += bytes(value);
  }
  return Object.fromEntries(Object.entries(result).sort((a, b) => b[1].value_bytes - a[1].value_bytes));
}
function quotations(rows) {
  const unique = new Map();
  let count = 0, total = 0;
  for (const quote of rows) {
    count++;
    total += bytes(quote);
    unique.set(quote, bytes(quote));
  }
  const distinct = [...unique.values()].reduce((a, b) => a + b, 0);
  return { count, unique_count: unique.size, value_bytes: total, unique_value_bytes: distinct, repeated_value_bytes: total - distinct };
}

// This projection measures a proposed transport. It does not create a release.
const core = pick(bundle, "contract_version snapshot channels organizations documents areas diseases source_coverage reviewed_chains");
const fieldSets = {
  records: "id document_id topic_id channel_id capture publication location_membership_ids",
  topics: "id label place_ids",
  places: "id label latitude longitude area_codes topic_ids relationship_ids location_membership_ids",
  location_memberships: "id record_id area_code role eligibility",
  relationships: "id from_place_id to_place_id eligibility",
  disease_reviews: "record_id disease_ids kind eligibility",
  comparisons: "id kind status participant_ids lineage eligibility",
  assertions: "id record_id measure_id eligibility",
  one_health_reviews: "id record_id outcome eligibility scope",
  one_health_nodes: "id record_id domain finding scope label observation_date period_start period_end eligibility document_ids evidence_ids record_ids",
  one_health_relations: "id from_node_id to_node_id source_assertion_id kind basis evidence_types directed observation_date period_start period_end eligibility document_ids evidence_ids record_ids",
  one_health_timings: "id node_id record_id record_ids source_assertion_id time eligibility",
  one_health_sampling_assessments: "id node_id record_id record_ids source_assertion_id positive_measure_id tested_measure_id time eligibility display proportion",
  one_health_contexts: "id node_ids record_id record_ids source_assertion_id measure_ids time eligibility label kind",
};
for (const [key, names] of Object.entries(fieldSets)) core[key] = bundle[key].map(row => pick(row, names));
for (const name of ["one_health_nodes", "one_health_relations"]) for (const row of core[name]) {
  for (const key of ["observation_date", "period_start", "period_end"]) row[key] = row[key].value;
}
for (const name of ["one_health_timings", "one_health_sampling_assessments", "one_health_contexts"]) {
  for (const row of core[name]) row.time = pick(row.time, "kind extent precision start end");
}

const figureFields = ["label", "metric", "value", "value_status", "unit", "count_kind", "case_class", "date_basis",
  "period_start", "period_end", "case_definition", "population", "stratum", "denominator", "denominator_status",
  "qualifier", "origin_authority", "disease", "pathogen", "host", "geography", "acquisition", "transmission_role",
  "as_of", "period_label", "denominator_population", "ratio_basis", "cumulative_baseline", "track_id",
  "review_status", "observation_date", "observation_date_status", "source_date_warning"];
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
const figureIds = new Map();
function figureIdentity(measure) {
  if (measure.value_status !== "reported" || !Number.isFinite(measure.value) || measure.observation_date === null ||
      measure.observation_date_status !== "reported" || measure.conflict_set || !figureFields.every(key => Object.hasOwn(measure, key))) return null;
  const key = JSON.stringify(figureFields.map(field => ordered(measure[field])));
  if (!figureIds.has(key)) figureIds.set(key, figureIds.size);
  return figureIds.get(key);
}
core.metrics = pick(bundle.metrics, "contract_version coverage");
core.metrics.panels = bundle.metrics.panels.map(row => pick(row, "kind id measure_ids"));
core.metrics.series = bundle.metrics.series.map(row => pick(row, "context_id measure_ids"));
core.metrics.reviewed_series = bundle.metrics.reviewed_series.map(row => pick(row, "series_id label operation members connections"));
core.metrics.measures = bundle.metrics.measures.map(row => ({
  ...pick(row, "measure_id context_id label metric value value_status unit observation_date priority source_id track_id superseded conflict_set geography disease count_kind period_label source_date_warning publication"),
  source_record_id: row.source_reference.record_id,
  evidence_record_ids: row.evidence_references.map(ref => ref.record_id),
  compact_figure_id: figureIdentity(row),
}));
if (values["display-core"]) {
  for (const key of ["places", ...Object.keys(fieldSets).filter(key => key.startsWith("one_health_"))]) {
    core[key] = bundle[key];
    fieldSets[key] = Object.keys(bundle[key][0]).join(" ");
  }
  core.metrics.reviewed_series = bundle.metrics.reviewed_series.map(({ evidence, ...row }) => row);
}

const strings = [], stringIds = new Map(), eligibility = [], eligibilityIds = new Map();
function text(value) {
  if (value === null) return null;
  if (!stringIds.has(value)) { stringIds.set(value, strings.length); strings.push(value); }
  return stringIds.get(value);
}
function recordSet(value) {
  assert.equal(value.rule, "all_supporting_records_in_window");
  assert.equal(value.partial, "hide_relationship_keep_visible_assertions");
  const ids = value.record_ids.map(text), key = JSON.stringify(ids);
  if (!eligibilityIds.has(key)) { eligibilityIds.set(key, eligibility.length); eligibility.push(ids); }
  return eligibilityIds.get(key);
}
function table(rows) {
  const columns = Object.keys(rows[0] ?? {});
  for (const row of rows) assert.deepEqual(Object.keys(row), columns);
  const encoding = columns.map(key => {
    const present = rows.map(row => row[key]).filter(value => value !== null);
    if (key === "eligibility") return "eligibility";
    if (present.length && present.every(value => typeof value === "string")) return "string";
    if (present.length && present.every(value => Array.isArray(value) && value.every(item => typeof item === "string"))) return "strings";
    return "json";
  });
  const result = { columns, encoding, rows: rows.map(row => columns.map((key, i) => {
    const value = row[key];
    return value === null ? null : encoding[i] === "string" ? text(value) : encoding[i] === "strings" ? value.map(text) : encoding[i] === "eligibility" ? recordSet(value) : value;
  })) };
  const restored = result.rows.map(row => Object.fromEntries(columns.map((key, i) => {
    const value = row[i];
    return [key, value === null ? null : encoding[i] === "string" ? strings[value] : encoding[i] === "strings" ? value.map(index => strings[index]) : encoding[i] === "eligibility"
      ? { rule: "all_supporting_records_in_window", record_ids: eligibility[value].map(index => strings[index]), partial: "hide_relationship_keep_visible_assertions" } : value];
  })));
  assert.deepEqual(restored, rows);
  return result;
}
const normalized = {};
for (const [key, value] of Object.entries(core)) {
  normalized[key] = key === "metrics" ? Object.fromEntries(Object.entries(value).map(([name, rows]) => [name, Array.isArray(rows) ? table(rows) : rows]))
    : Array.isArray(value) && value.length && typeof value[0] === "object" && key !== "reviewed_chains" ? table(value) : value;
}
normalized.strings = strings;
normalized.eligibility_record_sets = eligibility;
const mapCore = pick(map, "tracks map_links relationships");
mapCore.records = map.records.map(({ claims, ...row }) => row);
const report = {
  release_id: release.export_id,
  source_assets: release.assets,
  size_basis: "UTF-8 bytes of native JSON.stringify; source_assets retain exact published byte counts",
  bundle_compact_bytes: bytes(bundle),
  collections: Object.fromEntries(Object.entries(bundle).map(([key, value]) => [key, Array.isArray(value) ? collection(value) : { compact_bytes: bytes(value) }])),
  metrics: Object.fromEntries(Object.entries(bundle.metrics).map(([key, value]) => [key, Array.isArray(value) ? collection(value) : { compact_bytes: bytes(value) }])),
  field_totals: Object.fromEntries(["evidence", "assertions", "records"].map(key => [key, fields(bundle[key])]).concat(["measures", "series", "panels", "findings", "reviewed_series"].map(key => [`metrics.${key}`, fields(bundle.metrics[key])]))),
  quotations: {
    evidence: quotations(bundle.evidence.map(row => row.quote)),
    metric_references: quotations(bundle.metrics.measures.flatMap(row => row.evidence_references.flatMap(ref => ref.quotes))),
    evidence_and_metrics: quotations([...bundle.evidence.map(row => row.quote), ...bundle.metrics.measures.flatMap(row => row.evidence_references.flatMap(ref => ref.quotes))]),
    map_claims: quotations(map.records.flatMap(row => row.claims.flatMap(claim => claim.quotes))),
  },
  proposal: {
    variant: values["display-core"] ? "complete_one_health_and_places" : "selector_and_figure_projection",
    core_bytes: bytes(normalized), map_core_bytes: bytes(mapCore), total_bytes: bytes(normalized) + bytes(mapCore),
    core_collections: Object.fromEntries(Object.entries(normalized).map(([key, value]) => [key, bytes(value)])),
    metric_collections: Object.fromEntries(Object.entries(normalized.metrics).map(([key, value]) => [key, bytes(value)])),
    string_count: strings.length, eligibility_set_count: eligibility.length, compact_figure_count: figureIds.size,
    selector_projection_fields: fieldSets,
    measure_fields: Object.keys(core.metrics.measures[0]),
    checks: { source_checksums: true, table_round_trip: true, full_selector_parity: "requires producer selector and full detail reconstruction" },
  },
};
await writeFile(values.out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ release_id: report.release_id, source_bytes: release.assets["atlas-site.json"].bytes, ...report.proposal }, null, 2));
