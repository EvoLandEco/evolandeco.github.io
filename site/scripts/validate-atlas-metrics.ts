import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { COMPACT_GROUPING_VERSION } from "../src/lib/atlas-vendor/view.mjs";
import { createIdentities } from "../src/lib/atlas-identities";
import type { AtlasSiteBundle, AtlasMapSnapshot } from "../src/lib/atlas-contract";

export function validateAtlas(exportDirectory: string, snapshotPath: string) {
  const exportRoot = pathToFileURL(resolve(exportDirectory) + "/");
  const snapshot: AtlasMapSnapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
  const bundle: AtlasSiteBundle = JSON.parse(readFileSync(new URL("atlas-site.json", exportRoot), "utf8"));
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", exportRoot), "utf8"));
  const { reportOrganizations } = createIdentities(bundle, snapshot);
  const metrics = bundle.metrics;
  assert.equal(manifest.contract_version, bundle.contract_version);
  assert.deepEqual(Object.keys(manifest.files).sort(), ["annotations.schema.json", "atlas-site.json", "atlas-site.schema.json", "review.html", "view.mjs"]);
  assert.equal(createHash("sha256").update(readFileSync(snapshotPath)).digest("hex"), bundle.snapshot.source_snapshot_sha256, "ATLAS map snapshot differs from the export input");
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.equal(createHash("sha256").update(readFileSync(new URL(file, exportRoot))).digest("hex"), hash, `ATLAS bundle checksum: ${file}`);
  }
  z.fromJSONSchema(JSON.parse(readFileSync(new URL("atlas-site.schema.json", exportRoot), "utf8"))).parse(bundle);
  assert(["1.0.0", "1.1.0", "1.2.0"].includes(bundle.contract_version));
  assert.equal(COMPACT_GROUPING_VERSION, "1.0.0");

  z.fromJSONSchema(JSON.parse(readFileSync(new URL(`../src/lib/atlas-vendor/${bundle.metrics.contract_version === "0.2.0" ? "1.1/" : ""}metrics.schema.json`, import.meta.url), "utf8"))).parse(metrics);
  assert.equal(metrics.input_sha256, snapshot.input_sha256, "ATLAS inputs differ");
  const records = new Map(snapshot.records.map(r => [r.id, r]));
  for (const record of metrics.records) {
    const source = records.get(record.record_id);
    assert(source && source.document_id === record.document_id && source.track === record.track_id && source.publication === record.publication && source.capture === record.capture, `ATLAS record mismatch: ${record.record_id}`);
  }
  const measures = new Set(metrics.measures.map(m => m.measure_id));
  assert.equal(measures.size, metrics.measures.length);
  for (const measure of metrics.measures) {
    for (const ref of measure.evidence_references) {
      const record = records.get(ref.record_id);
      assert.equal(record?.document_id, ref.document_id);
      const claim = record?.claims.find(c => c.claim_index === ref.claim_index);
      assert(claim, `Missing metric claim: ${measure.measure_id}`);
      ref.quote_indexes.forEach((index, i) => {
        assert.equal(claim.quotes[index], ref.quotes[i]);
        assert.equal(createHash("sha256").update(ref.quotes[i]).digest("hex"), ref.quote_sha256[i]);
      });
    }
  }
  for (const panel of metrics.panels) {
    for (const id of panel.measure_ids) assert(measures.has(id), `Missing measure: ${id}`);
    for (const group of panel.card_groups) for (const id of group.measure_ids) assert(panel.measure_ids.includes(id));
  }
  for (const group of [...metrics.series, ...metrics.conflicts]) for (const id of group.measure_ids) assert(measures.has(id));
  console.log("Validated ATLAS measurements and source references.");

  assert.deepEqual([...records.keys()].sort(), bundle.records.map(r => r.id).sort(), "ATLAS record membership differs");
  assert.deepEqual(snapshot.tracks.map(t => t.id).sort(), bundle.topics.map(t => t.id).sort(), "ATLAS topic membership differs");
  const channels = new Map(bundle.channels.map(c => [c.id, c]));
  const organizations = new Set(bundle.organizations.map(o => o.id));
  const places = new Map(bundle.places.map(p => [p.id, p]));
  const memberships = new Map(bundle.location_memberships.map(m => [m.id, m]));
  const areas = new Set(bundle.areas.map(a => a.code));
  for (const channel of channels.values()) {
    assert(organizations.has(channel.organization_id));
    const organization = reportOrganizations[channel.snapshot_source];
    assert(organization.logo && existsSync(new URL(`../public/logos/atlas/${organization.logo}`, import.meta.url)), `Missing organization logo: ${channel.organization_id}`);
  }
  for (const topic of bundle.topics) for (const id of topic.place_ids) assert(places.has(id));
  if (snapshot.map_places) {
    assert.deepEqual(snapshot.map_places.map(p => p.id).sort(), bundle.places.filter(p => p.topic_ids.length).map(p => p.id).sort());
    for (const point of snapshot.map_places) {
      const place = places.get(point.id)!;
      assert.equal(point.lat, place.latitude);
      assert.equal(point.lon, place.longitude);
      assert.equal(point.label, place.label);
      assert.equal(point.precision, place.precision);
      assert.deepEqual(point.topic_ids, place.topic_ids);
      assert(point.eligibility.length > 0);
      for (const rule of point.eligibility) {
        assert.equal(rule.rule, "all_supporting_records_in_window");
        assert(rule.record_ids.length > 0 && rule.record_ids.every(id => records.has(id)));
      }
    }
  }
  for (const track of snapshot.tracks) {
    if (track.lat === undefined && track.lon === undefined) continue;
    assert(Number.isFinite(track.lat) && Number.isFinite(track.lon));
    const topic = bundle.topics.find(t => t.id === track.id)!;
    assert(topic.place_ids.some(id => places.get(id)!.latitude === track.lat && places.get(id)!.longitude === track.lon), `Globe coordinates differ: ${track.id}`);
  }
  for (const place of places.values()) for (const code of place.area_codes) assert(areas.has(code));
  for (const membership of memberships.values()) {
    assert(areas.has(membership.area_code));
    assert.equal(records.get(membership.record_id)?.document_id, membership.document_id);
  }
  for (const link of snapshot.map_links) {
    const relation = bundle.relationships.find(r => r.category === "geographic_link" && r.id === link.id);
    assert(relation, `Missing ATLAS relationship: ${link.id}`);
    assert.equal(relation.kind, link.type);
    assert.equal(relation.directed, link.directed);
    for (const [endpoint, id] of [[link.from, relation.from_place_id], [link.to, relation.to_place_id]] as const) {
      const place = places.get(id!);
      assert(place, `Missing ATLAS place: ${id}`);
      assert.equal(place.latitude, endpoint.lat);
      assert.equal(place.longitude, endpoint.lon);
    }
  }
  const assertions = new Map(bundle.assertions.map(a => [a.id, a]));
  const evidence = new Map(bundle.evidence.map(e => [e.id, e]));
  const documents = new Map(bundle.documents.map(d => [d.id, d]));
  for (const record of bundle.records) {
    const source = records.get(record.id);
    assert(source && source.document_id === record.document_id && source.publication === record.publication && source.capture === record.capture);
    assert.equal(source.track, record.topic_id);
    assert.equal(source.source, channels.get(record.channel_id)?.snapshot_source);
    for (const id of record.location_membership_ids) assert.equal(memberships.get(id)?.record_id, record.id);
  }
  for (const document of documents.values()) {
    assert(channels.has(document.channel_id));
    for (const id of document.record_ids) assert.equal(records.get(id)?.document_id, document.id);
  }
  for (const e of evidence.values()) {
    assert.equal(records.get(e.record_id)?.document_id, e.document_id);
    assert.equal(documents.get(e.document_id)?.text_sha256, e.source_text_sha256);
    assert.equal(createHash("sha256").update(e.quote).digest("hex"), e.quote_sha256);
    if (e.claim_index !== null) assert(records.get(e.record_id)?.claims.some(c => c.claim_index === e.claim_index));
    assert.equal([...e.quote].length, e.end - e.start);
  }
  for (const a of assertions.values()) {
    assert.equal(records.get(a.record_id)?.document_id, a.document_id);
    assert(a.measure_id === null || measures.has(a.measure_id));
    for (const id of a.evidence_ids) assert(evidence.has(id) && a.eligibility.record_ids.includes(evidence.get(id)!.record_id));
  }
  for (const c of bundle.comparisons) {
    for (const id of c.participant_ids) {
      assert(assertions.has(id));
      assert(assertions.get(id)!.eligibility.record_ids.every((r: string) => c.eligibility.record_ids.includes(r)));
    }
    for (const id of c.evidence_ids) assert(evidence.has(id) && c.eligibility.record_ids.includes(evidence.get(id)!.record_id));
  }
  console.log("Validated ATLAS assertions, comparisons and bundle checksums.");
  return { bundle, snapshot };
}
