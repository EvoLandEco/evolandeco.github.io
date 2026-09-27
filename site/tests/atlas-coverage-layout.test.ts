import test from "node:test";
import assert from "node:assert/strict";
import { coveragePositions } from "../src/lib/atlas-coverage-layout";

test("coverage gathers connected nodes without overlaps or lost nodes", () => {
  const original = [40, 240, 440, 640, 840];
  assert.equal(coveragePositions(original, new Set(), 400, 900), original);
  for (const anchor of [40, 400, 860]) {
    const positions = coveragePositions(original, new Set([0, 4]), anchor, 900);
    const sorted = [...positions].sort((a, b) => a - b);
    assert.equal(positions.length, original.length);
    assert.ok(sorted[0] >= 40 && sorted.at(-1)! <= 860);
    assert.ok(sorted.slice(1).every((y, i) => y - sorted[i] >= 54));
    assert.equal(positions[4] - positions[0], 54);
  }
  const dense = Array.from({ length: 24 }, (_, i) => 40 + i * 54);
  const positions = coveragePositions(dense, new Set([0, 23]), 640, 1336);
  assert.equal(positions[23] - positions[0], 54);
  const sorted = [...positions].sort((a, b) => a - b);
  assert.ok(sorted.slice(1).every((y, i) => y - sorted[i] >= 54));
});
