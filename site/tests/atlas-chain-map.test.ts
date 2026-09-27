import assert from "node:assert/strict";
import { test } from "node:test";
import { fitChainMap, chainLandDots, chainBadgePosition, chainEdgeGeometry, chainMapTransform } from "../src/lib/atlas-chain-map";

test("Chain extents fit regions, date-line crossings and coincident reference points", () => {
  for (const points of [
    [{ longitude: 25.45, latitude: 57.06 }, { longitude: 34.5, latitude: 39.3 }, { longitude: -97.48, latitude: 39.5 }],
    [{ longitude: 179, latitude: -17 }, { longitude: -179, latitude: -20 }],
    [{ longitude: 25.45, latitude: 57.06 }, { longitude: 25.45, latitude: 57.06 }],
    [{ longitude: 30, latitude: 85 }],
  ]) {
    const frame = fitChainMap(points)!;
    for (const p of points) {
      const { x, y } = frame.project(p);
      assert(x >= 70 && x <= 650 && y >= 60 && y <= 280);
    }
    const dots = chainLandDots(frame);
    assert(!/NaN|Infinity/.test(dots));
    if (points[0].latitude === 57.06) assert(dots.length > 0);
  }
  const crossing = fitChainMap([{ longitude: 179, latitude: -17 }, { longitude: -179, latitude: -20 }])!;
  assert(crossing.east - crossing.west < 30);
  assert.equal(fitChainMap([]), null);
});


test("Country badges occupy open link sectors and face outward from clusters", () => {
  const point = { x: 200, y: 200 };
  const left = chainBadgePosition(point, [{ x: 1, y: 0 }], 54, 24);
  assert(left.x + left.width < point.x - 15);
  const above = chainBadgePosition(point, [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }], 54, 24);
  assert(above.y + above.height < point.y - 15);
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const member = { x: 200 + 48 * Math.cos(angle), y: 200 + 48 * Math.sin(angle) };
    const badge = chainBadgePosition(member, [], 54, 24, point);
    const center = { x: badge.x + badge.width / 2, y: badge.y + badge.height / 2 };
    assert(Math.hypot(center.x - point.x, center.y - point.y) > 48);
    assert(Math.hypot(Math.max(badge.x - member.x, 0, member.x - badge.x - badge.width), Math.max(badge.y - member.y, 0, member.y - badge.y - badge.height)) >= 21.99);
  }
  assert.equal(chainEdgeGeometry(point, point), null);
  assert(chainEdgeGeometry(point, { x: 300, y: 200 })!.path.includes('Q'));
});

test("Short journey links clear both nodes and retain the approach direction", () => {
  for (const distance of [1, 20, 35, 36, 45, 55, 60, 100, 500]) for (const angle of [0, .7, Math.PI]) {
    const a = { x: 100, y: 100 }, b = { x: a.x + distance * Math.cos(angle), y: a.y + distance * Math.sin(angle) };
    const { start, end, control } = chainEdgeGeometry(a, b)!;
    assert(Math.abs(Math.hypot(start.x - a.x, start.y - a.y) - 17) < 1e-6);
    assert(Math.abs(Math.hypot(end.x - b.x, end.y - b.y) - 19) < 1e-6);
    assert((end.x - control.x) * (b.x - end.x) + (end.y - control.y) * (b.y - end.y) > 0);
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      const x = (1 - t) ** 2 * start.x + 2 * t * (1 - t) * control.x + t ** 2 * end.x;
      const y = (1 - t) ** 2 * start.y + 2 * t * (1 - t) * control.y + t ** 2 * end.y;
      assert(Math.hypot(x - a.x, y - a.y) > 15);
      assert(Math.hypot(x - b.x, y - b.y) > 15);
    }
  }
});


test("Map camera transforms preserve geographic coordinates across fitted extents", () => {
  for (const points of [
    [{ longitude: 4.9, latitude: 52.3 }, { longitude: 28, latitude: -26 }],
    [{ longitude: 179, latitude: -17 }, { longitude: -179, latitude: -20 }],
    [{ longitude: -2, latitude: 48 }, { longitude: 2, latitude: 50 }],
  ]) {
    const from = fitChainMap(points, 720, 340)!;
    const to = fitChainMap(points.slice(0, 1), 440, 500)!;
    const [sx, , , sy, x, y] = chainMapTransform(from, to).slice(7, -1).split(",").map(Number);
    const a = from.project(points[0]), b = to.project(points[0]);
    assert(Math.abs(a.x * sx + x - b.x) < 1e-8);
    assert(Math.abs(a.y * sy + y - b.y) < 1e-8);
    assert.equal(chainMapTransform(from, from), "matrix(1, 0, 0, 1, 0, 0)");
  }
  assert.equal(chainMapTransform(null, null), "matrix(1, 0, 0, 1, 0, 0)");
});
