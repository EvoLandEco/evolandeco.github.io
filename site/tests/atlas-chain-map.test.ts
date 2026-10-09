import assert from "node:assert/strict";
import { test } from "node:test";
import { fitChainMap, chainLandDots, chainBadgePosition, chainEdgeGeometry, chainMapTransform, chainCurveBounds, placeChainInset, chainTimeConnector } from "../src/lib/atlas-chain-map";

test("Timing connectors descend before turning right and retain space around event markers", () => {
  for (const gap of [0, 4, 20, 24, 30, 200]) {
    const path = chainTimeConnector({ x: 30, y: 22 }, { x: 30 + gap, y: 66 });
    assert(path.startsWith('M30 36L30 '));
    assert(path.endsWith(`L${30 + gap - 16} 66`));
    assert(!/NaN|Infinity/.test(path));
    const coordinates = [...path.matchAll(/[MLQ]([^MLQ]+)/g)].flatMap(match => match[1].split(' ').map(Number));
    for (let i = 1; i < coordinates.length; i += 2) assert(coordinates[i] >= 36 && coordinates[i] <= 66);
  }
});

test("Unlocated insets exhaust the corners and keep clear of occupied geometry", () => {
  const size = { width: 110, height: 96 };
  const corners = [{ x: 380, y: 10 }, { x: 10, y: 10 }, { x: 380, y: 294 }, { x: 10, y: 294 }];
  for (const free of corners) {
    const obstacles = corners.filter(corner => corner !== free).map(corner => ({ ...corner, ...size }));
    assert.deepEqual(placeChainInset(500, 400, size, obstacles), { ...free, ...size });
  }
  assert.deepEqual(placeChainInset(500, 400, size, []), { ...corners[0], ...size });
  const bounds = chainCurveBounds({ start: { x: 0, y: 0 }, control: { x: 100, y: 200 }, end: { x: 200, y: 0 } });
  assert.deepEqual(bounds, { x: -10, y: -10, width: 220, height: 120 });
  const straight = chainCurveBounds({ start: { x: 20, y: 20 }, control: { x: 30, y: 30 }, end: { x: 40, y: 40 } });
  assert.deepEqual(straight, { x: 10, y: 10, width: 40, height: 40 });
  const inset = placeChainInset(500, 400, size, [bounds]);
  assert(inset.x >= bounds.x + bounds.width || inset.y >= bounds.y + bounds.height);
  for (const outgoing of [true, false]) {
    const connected = placeChainInset(500, 400, size, [], [{ located: { x: 250, y: 200 }, offset: { x: 55, y: 61 }, outgoing }]);
    assert.equal(connected.y, 10, "Connections enter below the inset heading");
  }
});

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
