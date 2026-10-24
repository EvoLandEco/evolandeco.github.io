import { test } from "node:test";
import assert from "node:assert/strict";
import { geographicEnvelope, geographicGroups } from "../src/components/magicui/globe-network-geography";
import { countryContinent, networkContinents } from "../src/components/magicui/globe-network-regions";

test("Geographic sets retain overlapping memberships and separate disconnected components", () => {
  const nodes = [
    { location: [0, 0] as [number, number], countries: ["NL", "BE", "NL"] },
    { location: [1, 1] as [number, number], countries: ["NL"] },
    { location: [2, 2] as [number, number], countries: ["NL", "XX", "EU"] },
    { location: [3, 3] as [number, number] },
  ];
  const groups = geographicGroups(nodes, new Map([["0,0", 0], ["1,1", 0], ["2,2", 1], ["3,3", 2]]));
  assert.deepEqual([...groups.countries], [["NL", [0, 1, 2]], ["BE", [0]]]);
  assert.deepEqual(groups.envelopes.map(group => [group.code, group.members]), [["NL", [0, 1]], ["BE", [0]], ["NL", [2]]]);
  assert.deepEqual(groups.continents.map(group => group.members), [[0, 1], [2]]);
  assert.equal(geographicGroups([], new Map()).envelopes.length, 0);
});

test("Continent membership covers countries, overseas areas and neutral location codes without overlaps", () => {
  const codes = networkContinents.flatMap(region => region.countries.split(" "));
  assert.equal(new Set(codes).size, codes.length);
  for (const [code, region] of Object.entries({ NL: "150", XK: "150", TW: "142", PS: "142", TR: "142", RU: "150", MX: "003", GF: "005", GS: "005", RE: "002", NZ: "009", AQ: "AQ" })) {
    assert.equal(countryContinent.get(code)?.id, region, code);
  }
  assert.equal(countryContinent.get("XX"), undefined);
  assert.equal(countryContinent.get("EU"), undefined);
});

test("Rounded envelopes handle empty, coincident, collinear and polygonal memberships", () => {
  assert.equal(geographicEnvelope([], 10), "");
  const point = { x: 25, y: 50 };
  assert.equal(geographicEnvelope([point, point], 10), geographicEnvelope([point], 10));
  assert.match(geographicEnvelope([point], 10), /^M15,50a10,10/);
  const line = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
  assert.equal(geographicEnvelope(line, 10), "M0,10A10,10 0 0 1 0,-10L100,-10A10,10 0 0 1 100,10Z");
  const polygon = [...line, { x: 40, y: 70 }, { x: 40, y: 20 }];
  assert.equal(geographicEnvelope(polygon, 10), geographicEnvelope(polygon.toReversed(), 10));
  assert(!/NaN|Infinity/.test(geographicEnvelope(polygon, 10)));
  assert.equal(geographicEnvelope(polygon, 10).split("A").length - 1, 3);
});
