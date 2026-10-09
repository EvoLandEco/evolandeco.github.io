import { test } from "node:test";
import assert from "node:assert/strict";
import { bundle, atlas, mappedTracks, atlasDocuments, dateBounds, windowRecords, reportDocuments } from "./atlas-fixture";
import { dayDate, dayNumber, monthsBefore, supported, topicIds, groupGeographicLinks } from "../src/lib/atlas";
import { createAtlas } from "../src/lib/atlas";

test("Snapshot dates describe the capture and planned update", () => {
  assert.equal(atlas.snapshot.captured_at, atlas.records.map(r => r.capture).sort().at(-1));
  assert(dayNumber(atlas.snapshot.next_update_date) > dayNumber(atlas.snapshot.captured_at.slice(0, 10)));
  assert.equal(atlas.snapshot.next_update_status, "planned");
});

test("Route histories preserve all links and sort by complete supporting publication dates", () => {
  const records = new Map(atlas.records.map(r => [r.id, r]));
  const groups = groupGeographicLinks(atlas.map_links, records);
  assert(groups.length < atlas.map_links.length);
  assert.equal(groups.flatMap(g => g.entries).length, atlas.map_links.length);
  for (const group of groups) {
    assert.deepEqual(group.entries.map(e => e.date), group.entries.map(e => e.date).sort());
    for (const { link, date } of group.entries) assert.equal(date, link.support.map(([id]) => records.get(id)!.publication.slice(0, 10)).sort().at(-1));
  }
  assert.deepEqual(groupGeographicLinks([...atlas.map_links].reverse(), records).sort((a, b) => a.id.localeCompare(b.id)), [...groups].sort((a, b) => a.id.localeCompare(b.id)));
  const link = atlas.map_links.find(l => l.directed)!;
  assert.equal(groupGeographicLinks([link, { ...link, id: "reverse", from: link.to, to: link.from }], records).length, 2);
  assert.equal(groupGeographicLinks([{ ...link, directed: false }, { ...link, directed: false, id: "reverse", from: link.to, to: link.from }], records).length, 1);
});

test("Globe locations retain distinct places for one topic and only eligible records", () => {
  const first = bundle.places.find(p => p.topic_ids.length && p.record_ids.length)!;
  const record = atlas.records.find(r => r.id === first.record_ids[0])!;
  const second = { ...first, id: "test:second-place", label: "Second reporting place", latitude: first.latitude + 1, record_ids: [record.id] };
  const coincident = { ...first, id: "test:coincident-place", record_ids: [record.id] };
  const { mapLocations } = createAtlas(atlas, { ...bundle, places: [first, second, coincident] });
  const view = { place_ids: [first.id, second.id, coincident.id], relationship_ids: [], location_membership_ids: bundle.location_memberships.filter(m => m.record_id === record.id).map(m => m.id) };
  const points = mapLocations([record], view);
  assert.equal(points.length, 2);
  assert.equal(new Set(points.map(p => p.id)).size, 2);
  assert(points.every(p => p.topics.includes(record.track)));
  assert(points.every(p => p.records.length === 1 && p.records[0] === record.id));
  assert.deepEqual(mapLocations([], { ...view, place_ids: [] }), []);
  assert.equal(mapLocations([record], { ...view, place_ids: [first.id] }).length, 1);
});

test("Calendar presets handle month ends and leap years", () => {
  assert.equal(monthsBefore("2026-09-25", 1), "2026-08-25");
  assert.equal(monthsBefore("2026-09-25", 3), "2026-06-25");
  assert.equal(monthsBefore("2026-09-25", 6), "2026-03-25");
  assert.equal(monthsBefore("2026-03-31", 1), "2026-02-28");
  assert.equal(monthsBefore("2024-03-31", 1), "2024-02-29");
  assert.equal(monthsBefore("2024-02-29", 12), "2023-02-28");
});

test("ATLAS evidence is resolvable and date windows never leak later support", () => {
  assert.equal(new Set(atlas.records.map(r => r.id)).size, atlas.records.length);
  const tracks = new Set(atlas.tracks.map(t => t.id));
  for (const row of atlas.records) {
    assert(tracks.has(row.track));
    assert.equal(new URL(row.url).protocol, "https:");
    assert(Number.isFinite(Date.parse(row.publication)) && Number.isFinite(Date.parse(row.capture)));
  }
  for (const relation of [...atlas.map_links, ...atlas.relationships, ...atlas.relationships.flatMap(r => r.updates ?? [])]) {
    assert(relation.support.length > 0);
    for (const [id, index] of relation.support) {
      const row = atlas.records.find(r => r.id === id);
      assert(row?.claims.some(c => c.claim_index === index && c.quotes.length));
    }
    const dates = relation.support.map(([id]) => atlas.records.find(r => r.id === id)!.publication.slice(0, 10)).sort();
    const lastDate = dates[dates.length - 1];
    assert(supported(relation.support, windowRecords(dateBounds("publication")[0], lastDate, "publication")));
    assert(!supported(relation.support, windowRecords(dateBounds("publication")[0], dayDate(dayNumber(lastDate) - 1), "publication")));
  }
  for (const link of atlas.map_links) {
    assert(["movement", "shared_event", "hypothesis"].includes(link.type));
    assert(!link.directed || link.type === "movement");
    for (const endpoint of [link.from, link.to]) {
      assert(Math.abs(endpoint.lat) <= 90 && Math.abs(endpoint.lon) <= 180 && endpoint.precision);
    }
  }
  for (const basis of ["publication", "capture"] as const) {
    const [from, to] = dateBounds(basis);
    assert.equal(windowRecords(from, to, basis).length, atlas.records.length);
  }
  assert.deepEqual(topicIds("place:nigeria-lassa,nigeria-measles"), ["nigeria-lassa", "nigeria-measles"]);
});

test("Report logos and geographic badges follow the ATLAS export", async () => {
  const { existsSync } = await import("node:fs");
  const { reportOrganizations, trackCountries, countriesForReports } = await import("./atlas-fixture");
  for (const row of atlas.records) {
    assert(reportOrganizations[row.source], row.source);
    assert(existsSync(`public/logos/atlas/${reportOrganizations[row.source].logo}`));
    assert(trackCountries[row.track], row.track);
    for (const code of countriesForReports([row])) assert(bundle.areas.some(a => a.code === code), code);
  }
  const france = atlas.records.filter(r => r.id === "doc_128cebd0edb1e07102849fc4:2");
  assert.deepEqual(countriesForReports([...france, ...france]), ["FR"]);
  assert.deepEqual(countriesForReports(atlas.records.filter(r => r.id === "doc_0923ee49d439c50829f8c39d:4")), ["NZ"]);
  assert.deepEqual(countriesForReports(atlas.records.filter(r => r.track === "europe-derm")), ["DE", "AT", "ES", "FR", "NO", "SE"]);
});


test("Report grouping keeps documents intact with stable date ordering", () => {
  for (const basis of ["publication", "capture"] as const) {
    const documents = reportDocuments(atlas.records, basis);
    assert.equal(documents.length, bundle.documents.length);
    assert.equal(documents.flat().length, atlas.records.length);
    assert.deepEqual(reportDocuments([...atlas.records].reverse(), basis).map(rows => rows[0].document_id), documents.map(rows => rows[0].document_id));
    for (const rows of documents) assert(rows.every(r => r.document_id === rows[0].document_id));
    for (let i = 1; i < documents.length; i++) assert(atlasDocuments.get(documents[i - 1][0].document_id)![basis] >= atlasDocuments.get(documents[i][0].document_id)![basis]);
  }
  assert.equal(reportDocuments([], "publication").length, 0);
  const selected = reportDocuments(atlas.records, "publication", "place:france,france-import", "WHO_DON");
  assert.equal(selected.length, 3);
  assert(selected.flat().every(r => ["france", "france-import"].includes(r.track) && r.source === "WHO_DON"));
});

test("Globe country badges describe locations and ordered link endpoints", async () => {
  const { countriesForLocations, countriesForLink } = await import("./atlas-fixture");
  assert.deepEqual(countriesForLocations(["france", "france-import"]), ["FR"]);
  assert.deepEqual(countriesForLocations(["context:cholera-car-drc:DRC · South Ubangi cholera context"]), ["CD"]);
  for (const link of atlas.map_links) {
    const countries = countriesForLink(link);
    assert.equal(countries.length, 2);
    assert(countries.every(endpoint => endpoint.length > 0), link.id);
  }
  assert.deepEqual(countriesForLink(atlas.map_links.find(l => l.id === "drc-france-travel")!), [["CD"], ["FR"]]);
  assert.deepEqual(countriesForLink(atlas.map_links.find(l => l.id === "festival-sweden-finland")!), [["SE"], ["FI"]]);
});


test("Unlocated findings remain searchable without globe coordinates", () => {
  const unlocated = atlas.tracks.filter(t => !mappedTracks.some(m => m.id === t.id));
  assert(unlocated.length > 0);
  for (const topic of unlocated) {
    assert.equal(topic.lat, undefined);
    assert.equal(topic.lon, undefined);
    assert(reportDocuments(atlas.records, "publication", topic.id).length > 0);
  }
  for (const topic of mappedTracks) assert(Number.isFinite(topic.lat) && Number.isFinite(topic.lon));
});

test('Publication eligibility applies to both weekly date bases and their bounds', () => {
  const undated = { ...atlas.records[0], id: 'undated-report', publication: '', capture: '2099-01-01T00:00:00Z' };
  const view = createAtlas({ ...atlas, records: [...atlas.records, undated] }, bundle);
  for (const basis of ['publication', 'capture'] as const) {
    assert.deepEqual(view.dateBounds(basis), dateBounds(basis));
    assert(!view.windowRecords('1900-01-01', '2100-01-01', basis).some(row => row.id === undated.id));
  }
});
