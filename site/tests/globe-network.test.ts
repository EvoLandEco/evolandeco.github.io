import { test } from "node:test";
import assert from "node:assert/strict";
import { networkLayout, networkCurve, networkProjection, networkSurface, stressLayout, viewMix, type GlobeMode } from "../src/components/magicui/globe-network";
import { globeMapProjection } from "../src/components/magicui/globe-map";
import { globePoint, prepareGlobeArc, GLOBE_RADIUS, type Vec3 } from "../src/components/magicui/globe-effects";

const a: [number, number] = [10, 170], b: [number, number] = [30, -160], c: [number, number] = [52, 5];
const links = [{ id: "ab", from: a, to: b }, { id: "ba", from: b, to: a }, { id: "bc", from: b, to: c }];
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);

test("The network layout is deterministic, bounded and retains isolated locations", () => {
  const locations: [number, number][] = [a, b, c, ...Array.from({ length: 80 }, (_, i): [number, number] => [i, i])];
  const layout = networkLayout(locations, links);
  assert.deepEqual(layout, networkLayout([...locations].reverse(), [...links].reverse()));
  assert.equal(layout.positions.size, 83);
  for (const point of layout.positions.values()) assert(Math.hypot(point.x, point.y) < .95);
  const positions = [...layout.positions.values()];
  for (let i = 0; i < positions.length; i++) for (let j = i + 1; j < positions.length; j++) {
    assert(Math.hypot(positions[i].x - positions[j].x, positions[i].y - positions[j].y) > .01);
  }
  assert.equal(networkLayout([], []).positions.size, 0);
  assert(Math.hypot(...Object.values(networkLayout([a], []).positions.get(a.join(","))!)) > .88);
});

test("Network paths preserve endpoints, parallel lanes, trail positions and self loops", () => {
  const layout = networkLayout([a, b, c], links);
  const start = layout.positions.get(a.join(","))!, end = layout.positions.get(b.join(","))!;
  const forward = networkCurve(start, end, layout.bends.get("ab"));
  const backward = networkCurve(end, start, layout.bends.get("ba"));
  assert.deepEqual(forward(0), start); close(forward(1).x, end.x); close(forward(1).y, end.y);
  assert.notDeepEqual(forward(.5), backward(.5));
  assert.notDeepEqual(networkCurve(start, start)(.5), start);
  const arc = prepareGlobeArc(a, b);
  const buffer = new Float32Array(768), gradient = new Float32Array(4);
  for (const map of [0, 1]) {
    const project = networkProjection(globeMapProjection(4.08, .22, map), forward, 1);
    const path = arc.path(project);
    assert.equal(path.split("M").length - 1, 1);
    assert.equal(arc.pathSegments(project, buffer), 96);
    arc.trailSegments(project, buffer, gradient, .6, .2);
    close(gradient[0], Math.fround(500 + networkSurface(forward(.4)).x * 480));
    close(gradient[1], Math.fround(500 - networkSurface(forward(.4)).y * 480));
    assert(!/NaN|Infinity/.test(path + arc.arrow(project)));
  }
});

test("Date-line copies converge on the same network point without stretching across the map", () => {
  const geo = globeMapProjection(4.08, .22, 1);
  const from = globePoint([20, 179]).map(v => v * GLOBE_RADIUS) as Vec3;
  const to = globePoint([20, -179]).map(v => v * GLOBE_RADIUS) as Vec3;
  const curve = networkCurve({ x: -.5, y: -.3 }, { x: .5, y: .3 });
  const original = geo.split!(from, to)!;
  let last = Infinity;
  for (const mix of [0, .1, .5, .9, .999]) {
    const project = networkProjection(geo, curve, mix);
    const edges = project.split!(from, to, .4, .6)!;
    const gap = Math.hypot(edges[0].x - edges[1].x, edges[0].y - edges[1].y);
    assert(gap < last); last = gap;
    close(edges[0].x, original[0].x * (1 - mix) + networkSurface(curve(.5)).x * mix);
    close(edges[1].x, original[1].x * (1 - mix) + networkSurface(curve(.5)).x * mix);
  }
  assert.equal(networkProjection(geo, curve, 1).split, undefined);
});

test("Every mode pair and interrupted transition starts from the exact rendered mix", () => {
  const modes: GlobeMode[] = ["globe", "map", "network"];
  for (const first of modes) for (const second of modes) {
    const from = viewMix({ map: 0, network: 0 }, first, 1);
    assert.deepEqual(viewMix(from, second, 0), from);
    const end = viewMix(from, second, 1);
    assert.equal(end.network, second === "network" ? 1 : 0);
    if (second !== "network") assert.equal(end.map, second === "map" ? 1 : 0);
    for (const progress of [.01, .3, .7, .99]) {
      const current = viewMix(from, second, progress);
      for (const third of modes) {
        assert.deepEqual(viewMix(current, third, 0), current);
        const next = viewMix(current, third, .0001);
        assert(Math.abs(next.network - current.network) < 1e-8);
        assert(Math.abs(next.map - current.map) <= .0001);
      }
    }
  }
});


test("Connected components fill the centre while singletons occupy the perimeter", () => {
  const isolated: [number, number][] = Array.from({ length: 180 }, (_, i) => [i / 2, i]);
  const layout = networkLayout([a, b, c, ...isolated], links);
  assert.equal(layout.isolated.size, isolated.length);
  for (const [key, point] of layout.positions) {
    const radius = Math.hypot(point.x, point.y);
    if (layout.isolated.has(key)) assert(radius > .88 && radius < .99);
    else assert(radius <= .77);
  }
  const connected = [a, b, c].map(location => layout.positions.get(location.join(","))!);
  assert(Math.max(...connected.flatMap(a => connected.map(b => Math.hypot(a.x - b.x, a.y - b.y)))) > 1);
  const filtered = networkLayout([a, b, c], [links[0]]);
  assert(filtered.isolated.has(c.join(",")));
  const selfLoop = networkLayout([a], [{ id: "loop", from: a, to: a }]);
  assert.equal(selfLoop.isolated.size, 0);
});

test("Graph-distance stress preserves the ordering and spacing of a chain", () => {
  const points = stressLayout(6, [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]]);
  let stress = 0;
  for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
    stress += (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) / (j - i) - 1) ** 2;
  }
  assert(stress < .005, `chain stress ${stress}`);
});

test("The convex surface enlarges central distances and keeps every route attached to its nodes", () => {
  assert(networkSurface({ x: .3, y: 0 }).x > .38);
  const arc = prepareGlobeArc(a, b), start = { x: -.55, y: .12 }, end = { x: .64, y: -.27 };
  const curve = networkCurve(start, end, .05);
  const projection = networkProjection(globeMapProjection(4.08, .22, 0), curve, 1);
  for (const [location, t, point] of [[a, 0, start], [b, 1, end]] as const) {
    const p = projection(globePoint([...location]), t), expected = networkSurface(point);
    close(p.x, expected.x); close(p.y, expected.y);
  }
  assert(arc.path(projection).startsWith(`M${(500 + networkSurface(start).x * 480).toFixed(2)}`));
  let previous = 0;
  for (let i = 1; i <= 100; i++) {
    const p = networkSurface({ x: i / 100, y: 0 });
    assert(p.x > previous && p.x <= 1); previous = p.x;
  }
});
