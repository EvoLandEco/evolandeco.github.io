import { test } from "node:test";
import assert from "node:assert/strict";
import {
  globePoint,
  arcPoint,
  projectPoint,
  GLOBE_RADIUS,
} from "../src/components/magicui/globe-effects";
test("Globe effects share spherical coordinates, arc endpoints and occlusion", () => {
  const a = globePoint([52, 5]),
    b = globePoint([40, 116]);
  assert(Math.abs(Math.hypot(...a) - 1) < 1e-12);
  for (const [t, p] of [
    [0, a],
    [1, b],
  ] as const) {
    const q = arcPoint(a, b, t);
    for (let i = 0; i < 3; i++)
      assert(Math.abs(q[i] - p[i] * GLOBE_RADIUS) < 1e-12);
  }
  assert(Math.hypot(...arcPoint(a, b, 0.5)) > GLOBE_RADIUS + 0.1);
  assert.equal(projectPoint([0, 0, -0.8], 0, 0).visible, false);
  assert.equal(projectPoint([0, 0, 0.8], 0, 0).visible, true);
  assert.equal(projectPoint([0.9, 0, -0.1], 0, 0).visible, true);
});
