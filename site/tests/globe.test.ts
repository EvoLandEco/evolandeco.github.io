import { test } from "node:test";
import assert from "node:assert/strict";
import {
  globePoint,
  arcPoint,
  projectPoint,
  GLOBE_RADIUS,
  focusOrientation,
  projectArcPath,
  projectArcArrow,
  projectArcTrail,
  projectArcAnchor,
  rimIndicator,
  separateGlobeRoutes,
  geographicArc,
  prepareGlobeArc,
  globeProjection,
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


test("Globe focus centers latitude and longitude through the shortest turn", () => {
  for (const location of [[52, 5], [-33, 151], [0, -179], [89, 160]] as [number, number][]) {
    for (const start of [-12, 0, 4.08, 20]) {
      const camera = focusOrientation(location, start);
      assert(Math.abs(camera.phi - start) <= Math.PI);
      const center = projectPoint(globePoint(location), camera.phi, camera.theta);
      assert(Math.abs(center.x) < 1e-12 && Math.abs(center.y) < 1e-12 && center.z > .99);
    }
  }
  const from: [number, number] = [0, 10], to: [number, number] = [35, 30];
  const camera = focusOrientation(to, 0);
  const path = projectArcPath(from, to, camera.phi, true, camera.theta);
  assert(path.endsWith("L500.00,500.00 "));
  assert(projectArcArrow(from, to, camera.phi, camera.theta));
});


test("Travelling arrows and tails follow the directed geographic curve", () => {
  const from: [number, number] = [0, 0], to: [number, number] = [30, 20];
  const camera = focusOrientation([15, 10], 0);
  const pointAt = geographicArc(globePoint(from), globePoint(to));
  for (const t of [.1, .5, .9]) {
    const tip = projectPoint(pointAt(t), camera.phi, camera.theta);
    const arrow = projectArcArrow(from, to, camera.phi, camera.theta, undefined, t);
    assert(arrow.includes(`L${500 + tip.x * 480},${500 - tip.y * 480}`));
    const trail = projectArcPath(from, to, camera.phi, true, camera.theta, undefined, [Math.max(0, t - .16), t]);
    assert(trail.endsWith(`L${(500 + tip.x * 480).toFixed(2)},${(500 - tip.y * 480).toFixed(2)} `));
  }
  assert.equal(projectArcArrow([0, 170], [0, -170], -Math.PI / 2, 0, undefined, .5), "");
});

test("Far-side event bearings follow rotation around the globe rim", () => {
  const point = globePoint([30, 0]);
  const entry = rimIndicator(projectPoint(point, .1, 0));
  const back = rimIndicator(projectPoint(point, Math.PI / 2, 0));
  const exit = rimIndicator(projectPoint(point, Math.PI - .1, 0));
  assert(entry && back && exit);
  assert(entry.x > 0 && exit.x < 0);
  assert(Math.abs(back.x) < 1e-12 && back.y > 0);
  for (const rim of [entry, back, exit]) {
    assert(Math.abs(Math.hypot(rim.x, rim.y) - (GLOBE_RADIUS + .035)) < 1e-12);
    const radians = rim.angle * Math.PI / 180;
    assert(Math.cos(radians) * rim.x - Math.sin(radians) * rim.y < 0);
  }
  assert.equal(rimIndicator(projectPoint(point, -.1, 0)), null);
  assert.equal(rimIndicator(projectPoint(point, Math.PI + .1, 0)), null);
  assert.equal(rimIndicator({x: 0, y: 0, z: -1, visible: false}), null);
  const edge = rimIndicator(projectPoint(point, .001, 0));
  assert(edge && edge.opacity > 0 && edge.opacity < entry.opacity);
});

test("Link callout anchors stay on the visible geographic curve", () => {
  const from: [number, number] = [0, 10], to: [number, number] = [35, 30];
  const camera = focusOrientation(from, 0);
  const anchor = projectArcAnchor(from, to, camera.phi, camera.theta);
  assert(anchor?.visible);
  const path = projectArcPath(from, to, camera.phi, true, camera.theta);
  assert(path.includes(`${(500 + anchor.x * 480).toFixed(2)},${(500 - anchor.y * 480).toFixed(2)}`));
  assert.equal(projectArcAnchor([0, 170], [0, -170], -Math.PI / 2, 0), null);
});

test("Globe anchors stop at the nearest visible sample without changing occlusion", () => {
  for (const [from, to] of [
    [[4, 21], [48, 2]], [[0, 0], [0, 1]], [[-41, 175], [52, 5]],
  ] as [[number, number], [number, number]][]) {
    const curve = geographicArc(globePoint(from), globePoint(to));
    const prepared = prepareGlobeArc(from, to);
    for (let i = 0; i < 72; i++) {
      const project = globeProjection(i * Math.PI / 36, .22);
      const samples = Array.from({ length: 97 }, (_, index) => ({
        point: project(curve(index / 96)), distance: Math.abs(index / 96 - .5),
      }));
      let connected = false;
      const path = samples.map(({ point }) => {
        if (!point.visible) { connected = false; return ""; }
        const command = connected ? "L" : "M";
        connected = true;
        return `${command}${(500 + point.x * 480).toFixed(2)},${(500 - point.y * 480).toFixed(2)} `;
      }).join("");
      const visible = samples.filter(({ point }) => point.visible).sort((a, b) => a.distance - b.distance);
      let calls = 0;
      const counted: typeof project = point => { calls++; return project(point); };
      assert.equal(prepared.path(counted), path);
      assert.deepEqual(prepared.anchor(counted), visible[0]?.point ?? null);
      assert.equal(prepared.path(counted), path);
      assert.equal(calls, 97);
    }
    const center = curve(.5);
    const target = focusOrientation([
      Math.asin(center[1] / Math.hypot(...center)) * 180 / Math.PI,
      Math.atan2(center[2], -center[0]) * 180 / Math.PI + 180,
    ], 0);
    const project = globeProjection(target.phi, target.theta);
    let calls = 0;
    prepared.anchor(point => { calls++; return project(point); });
    assert.equal(calls, 1);
  }
});

test("Beam paths reuse endpoint projections with identical gradient coordinates", () => {
  const from: [number, number] = [4, 20], to: [number, number] = [50, 3];
  const prepared = prepareGlobeArc(from, to);
  const curve = geographicArc(globePoint(from), globePoint(to));
  const camera = focusOrientation(from, 0);
  const project = globeProjection(camera.phi, camera.theta);
  let calls = 0;
  const trail = prepared.trail(point => { calls++; return project(point); }, .9, .45);
  assert.equal(calls, 45);
  assert.equal(trail.path, prepared.path(project, .45, .9));
  const tail = project(curve(.45)), head = project(curve(.9));
  assert.deepEqual([trail.x1, trail.y1, trail.x2, trail.y2], [500 + tail.x * 480, 500 - tail.y * 480, 500 + head.x * 480, 500 - head.y * 480]);
});

test("Short geographic links form compact outward arcs with aligned callouts and arrows", () => {
  const from: [number, number] = [0, 0], to: [number, number] = [0, 1];
  const phi = -Math.PI / 4;
  const anchor = projectArcAnchor(from, to, phi, 0);
  assert(anchor);
  const pointAt = geographicArc(globePoint(from), globePoint(to));
  const height = Math.hypot(anchor.x, anchor.y, anchor.z) - GLOBE_RADIUS;
  assert(height > .08 && height < .1);
  const chord = globePoint(to).map((v, i) => v - globePoint(from)[i]);
  const departure = pointAt(.001).map((v, i) => v - pointAt(0)[i]);
  assert(departure.reduce((dot, v, i) => dot + v * chord[i], 0) < 0);
  assert.deepEqual(pointAt(0), globePoint(from).map(v => v * GLOBE_RADIUS));
  assert.deepEqual(pointAt(1), globePoint(to).map(v => v * GLOBE_RADIUS));
  for (let i = 0; i <= 100; i++) assert(Math.hypot(...pointAt(i / 100)) >= GLOBE_RADIUS - 1e-12);
  const reverse = geographicArc(globePoint(to), globePoint(from));
  for (let i = 0; i <= 100; i++) {
    const p = pointAt(i / 100), q = reverse(1 - i / 100);
    assert(Math.hypot(...p.map((v, k) => v - q[k])) < 1e-12);
  }
  const loop = geographicArc(globePoint(from), globePoint(from));
  assert(loop(.25).every(Number.isFinite));
  const path = projectArcPath(from, to, phi, true, 0);
  assert(path.includes(`${(500 + anchor.x * 480).toFixed(2)},${(500 - anchor.y * 480).toFixed(2)}`));
  const tip = projectPoint(pointAt(.91), phi, 0);
  assert(projectArcArrow(from, to, phi, 0).includes(`L${500 + tip.x * 480},${500 - tip.y * 480}`));
});

test("Parallel routes separate consistently without moving endpoints or callouts", () => {
  const routes = [
    { id: "a", from: [0, 0], to: [35, 10] },
    { id: "b", from: [0, 0], to: [36, 11] },
    { id: "c", from: [-40, 120], to: [-20, 150] },
  ] as { id: string; from: [number, number]; to: [number, number] }[];
  const bends = separateGlobeRoutes(routes);
  assert(Math.hypot(...bends[1]) > .1);
  assert.equal(Math.hypot(...bends[2]), 0);
  assert.deepEqual(separateGlobeRoutes([...routes].reverse()).reverse(), bends);
  const midpoint = (i: number, bend?: [number, number, number]) => arcPoint(globePoint(routes[i].from), globePoint(routes[i].to), .5, .32, bend);
  const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
  assert(distance(midpoint(0, bends[0]), midpoint(1, bends[1])) > distance(midpoint(0), midpoint(1)) + .05);
  const route = routes[1], a = globePoint(route.from), b = globePoint(route.to);
  assert.deepEqual(arcPoint(a, b, 0, .4, bends[1]), arcPoint(a, b, 0));
  assert.deepEqual(arcPoint(a, b, 1, .4, bends[1]), arcPoint(a, b, 1));
  const camera = focusOrientation(route.from, 0);
  const path = projectArcPath(route.from, route.to, camera.phi, true, camera.theta, bends[1]);
  assert.notEqual(path, projectArcPath(route.from, route.to, camera.phi, true, camera.theta));
  const anchor = projectArcAnchor(route.from, route.to, camera.phi, camera.theta, bends[1]);
  assert(anchor);
  assert(path.includes(`${(500 + anchor.x * 480).toFixed(2)},${(500 - anchor.y * 480).toFixed(2)}`));
  assert(projectArcArrow(route.from, route.to, camera.phi, camera.theta, bends[1]));
  const opposite = [{ ...routes[0], id: "reverse", from: routes[0].to, to: routes[0].from }];
  assert(Math.hypot(...separateGlobeRoutes([routes[0], ...opposite])[1]) > .1);
});


test("Dense route bundles keep distinct lanes inside the globe viewport", () => {
  const routes = Array.from({ length: 40 }, (_, i) => ({
    id: `route-${i}`, from: [4, 21] as [number, number], to: [48, 2] as [number, number],
  }));
  const bends = separateGlobeRoutes(routes);
  assert.equal(new Set(bends.map(bend => JSON.stringify(bend))).size, routes.length);
  assert.deepEqual(separateGlobeRoutes([...routes].reverse()).reverse(), bends);
  const pointAt = geographicArc(globePoint(routes[0].from), globePoint(routes[0].to));
  for (const bend of bends) {
    assert(Math.hypot(...bend) <= .36 + 1e-12);
    for (let i = 0; i <= 100; i++) assert(Math.hypot(...pointAt(i / 100, bend)) < 500 / 480);
    assert.deepEqual(pointAt(0, bend), pointAt(0));
    assert.deepEqual(pointAt(1, bend), pointAt(1));
  }
});

test("Shared-origin route lanes avoid crossing toward nearby destinations", () => {
  const routes = [
    { id: "france", from: [4, 21], to: [48, 2] },
    { id: "germany", from: [4, 21], to: [51, 10] },
  ] as { id: string; from: [number, number]; to: [number, number] }[];
  const bends = separateGlobeRoutes(routes);
  const camera = focusOrientation([28, 15], 0);
  const crossingCount = (sign: number) => {
    const paths = routes.map((route, k) => Array.from({ length: 101 }, (_, i) =>
      projectPoint(arcPoint(globePoint(route.from), globePoint(route.to), i / 100, .4,
        bends[k].map(v => v * sign) as [number, number, number]), camera.phi, camera.theta)));
    const side = (a: {x: number; y: number}, b: typeof a, c: typeof a) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    let count = 0;
    for (let i = 1; i < 101; i++) for (let j = 1; j < 101; j++) {
      const [a, b, c, d] = [paths[0][i - 1], paths[0][i], paths[1][j - 1], paths[1][j]];
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) count++;
    }
    return count;
  };
  assert.equal(crossingCount(1), 0);
  assert(crossingCount(-1) > 0);
});

test("Arrow tail gradients follow the same projected route and destination", () => {
  const from: [number, number] = [4, 20], to: [number, number] = [50, 3];
  const camera = focusOrientation(from, 0);
  for (const progress of [.05, .5, .95]) {
    const trail = projectArcTrail(from, to, camera.phi, camera.theta, undefined, progress);
    assert.equal(trail.path, projectArcPath(from, to, camera.phi, true, camera.theta, undefined, [Math.max(0, progress - .22), progress]));
    const tip = projectPoint(geographicArc(globePoint(from), globePoint(to))(progress), camera.phi, camera.theta);
    assert.equal(trail.x2, 500 + tip.x * 480);
    assert.equal(trail.y2, 500 - tip.y * 480);
    assert([trail.x1, trail.y1, trail.x2, trail.y2].every(Number.isFinite));
  }
});


test("Travel beams enter the destination until the full tail has passed", () => {
  const from: [number, number] = [4, 20], to: [number, number] = [50, 3];
  const camera = focusOrientation(from, 0);
  const destination = projectPoint(geographicArc(globePoint(from), globePoint(to))(1), camera.phi, camera.theta);
  const end = [500 + destination.x * 480, 500 - destination.y * 480];
  const length = .45;
  for (const progress of [1, 1.1, 1.25, 1.4, 1.449]) {
    const trail = projectArcTrail(from, to, camera.phi, camera.theta, undefined, progress, length);
    assert.equal(trail.path, projectArcPath(from, to, camera.phi, true, camera.theta, undefined, [progress - length, 1]));
    assert(trail.path.endsWith(`L${end[0].toFixed(2)},${end[1].toFixed(2)} `));
    const fraction = (1 - (progress - length)) / length;
    assert(Math.abs(trail.x1 + (trail.x2 - trail.x1) * fraction - end[0]) < 1e-8);
    assert(Math.abs(trail.y1 + (trail.y2 - trail.y1) * fraction - end[1]) < 1e-8);
  }
  for (const progress of [0, 1.45, 1.6]) {
    const trail = projectArcTrail(from, to, camera.phi, camera.theta, undefined, progress, length);
    assert.equal(trail.path, "");
    assert([trail.x1, trail.y1, trail.x2, trail.y2].every(Number.isFinite));
  }
});

test("Segment buffers preserve path samples, visibility breaks, trails and directed arrows", () => {
  const routes = [
    { id: "long", from: [4, 21], to: [48, 2], geographic: true },
    { id: "lane", from: [4, 21], to: [51, 10], geographic: true },
    { id: "short", from: [0, 0], to: [0, 1], geographic: true },
    { id: "loop", from: [0, 0], to: [0, 0], geographic: true },
    { id: "rim", from: [-41, 175], to: [52, 5], geographic: true },
    { id: "home", from: [35, 139], to: [52, 5], geographic: false },
  ] as { id: string; from: [number, number]; to: [number, number]; geographic: boolean }[];
  const bends = separateGlobeRoutes(routes);
  assert(bends.some(bend => Math.hypot(...bend) > 0));
  const output = new Float32Array(96 * 4), arrow = new Float32Array(8), gradient = new Float32Array(4);
  let hidden = 0, partial = 0, visible = 0;
  const compareSvg = (buffer: Float32Array, count: number, path: string) => {
    const expected: number[] = [];
    let x = 0, y = 0;
    for (const match of path.matchAll(/([ML])([^, ]+),([^ ]+)/g)) {
      const nextX = Number(match[2]), nextY = Number(match[3]);
      if (match[1] === "L") expected.push(x, y, nextX, nextY);
      x = nextX; y = nextY;
    }
    assert.equal(count * 4, expected.length);
    for (let i = 0; i < expected.length; i++) assert(Math.abs(buffer[i] - expected[i]) < .0051);
  };
  for (const [index, route] of routes.entries()) {
    const a = globePoint(route.from), b = globePoint(route.to), bend = bends[index];
    const curve = route.geographic ? geographicArc(a, b) : (t: number, lane?: [number, number, number]) => arcPoint(a, b, t, .4, lane);
    const prepared = prepareGlobeArc(route.from, route.to, route.geographic, bend);
    for (const theta of [-.65, .22, .9]) for (let turn = 0; turn < 24; turn++) {
      const project = globeProjection(turn * Math.PI / 12, theta);
      const reference = (start: number, end: number) => {
        const expected: number[] = [];
        const steps = Math.max(1, Math.ceil(96 * (end - start)));
        let previous: ReturnType<typeof project> | null = null;
        for (let i = 0; i <= steps; i++) {
          const point = project(curve(start + (end - start) * i / steps, bend));
          if (point.visible && previous) expected.push(
            500 + previous.x * 480, 500 - previous.y * 480,
            500 + point.x * 480, 500 - point.y * 480,
          );
          previous = point.visible ? point : null;
        }
        return expected.map(Math.fround);
      };
      output.fill(NaN);
      const count = prepared.pathSegments(project, output);
      const path = prepared.path(project);
      assert.deepEqual(Array.from(output.subarray(0, count * 4)), reference(0, 1));
      compareSvg(output, count, path);
      if (!count) hidden++; else if (count === 96) visible++; else partial++;
      assert(output.subarray(count * 4).every(Number.isNaN));
      for (const progress of [0, .05, .5, .99, 1, 1.25, 1.449, 1.45, 1.6]) {
        const length = .45;
        const start = Math.min(1, Math.max(0, progress - length)), end = Math.min(1, Math.max(0, progress));
        output.fill(NaN);
        const count = prepared.trailSegments(project, output, gradient, progress, length);
        assert.deepEqual(Array.from(output.subarray(0, count * 4)), end > start ? reference(start, end) : []);
        const trail = prepared.trail(project, progress, length);
        compareSvg(output, count, trail.path);
        assert.deepEqual(Array.from(gradient), [trail.x1, trail.y1, trail.x2, trail.y2].map(Math.fround));
        assert(output.subarray(count * 4).every(Number.isNaN));
        if (progress <= 1) {
          arrow.fill(NaN);
          const count = prepared.arrowSegments(project, arrow, progress);
          compareSvg(arrow, count, prepared.arrow(project, progress));
          const tip = project(curve(progress, bend)), tail = project(curve(Math.max(0, progress - .01), bend));
          const dx = tip.x - tail.x, dy = tail.y - tip.y, size = Math.hypot(dx, dy);
          const x = 500 + tip.x * 480, y = 500 - tip.y * 480;
          const ux = dx / size, uy = dy / size;
          const expected = tip.visible && tail.visible && size ? [
            x - ux * 13 - uy * 6, y - uy * 13 + ux * 6, x, y,
            x, y, x - ux * 13 + uy * 6, y - uy * 13 - ux * 6,
          ] : [];
          assert.deepEqual(Array.from(arrow.subarray(0, count * 4)), expected.map(Math.fround));
          assert(arrow.subarray(count * 4).every(Number.isNaN));
        }
      }
    }
  }
  assert(hidden > 0 && partial > 0 && visible > 0);
});

test("Segment buffers leave gaps and isolated visible samples disconnected", () => {
  const from: [number, number] = [4, 21], to: [number, number] = [48, 2];
  const prepared = prepareGlobeArc(from, to), curve = geographicArc(globePoint(from), globePoint(to));
  const projection = globeProjection(-1.8, .22), output = new Float32Array(96 * 4);
  const samples = Array.from({ length: 97 }, (_, i) => projection(curve(i / 96)));
  let index = 0;
  const project: typeof projection = point => {
    const i = index++;
    return { ...projection(point), visible: i < 15 || i >= 35 && i <= 65 || i === 80 };
  };
  const count = prepared.pathSegments(project, output);
  const expected: number[] = [];
  for (const i of [...Array.from({ length: 14 }, (_, i) => i + 1), ...Array.from({ length: 30 }, (_, i) => i + 36)]) {
    const a = samples[i - 1], b = samples[i];
    expected.push(500 + a.x * 480, 500 - a.y * 480, 500 + b.x * 480, 500 - b.y * 480);
  }
  assert.equal(count, 44);
  assert.deepEqual(Array.from(output.subarray(0, count * 4)), expected.map(Math.fround));
  assert.equal([...prepared.path(project).matchAll(/M/g)].length, 3);
  assert.equal(index, 97);
});

test("SVG and segment paths share projected samples in either call order", () => {
  const prepared = prepareGlobeArc([4, 21], [48, 2]);
  const output = new Float32Array(96 * 4), gradient = new Float32Array(4);
  for (const bufferFirst of [true, false]) {
    let calls = 0;
    const projection = globeProjection(-1.8, .22);
    const project: typeof projection = point => { calls++; return projection(point); };
    if (bufferFirst) prepared.pathSegments(project, output); else prepared.path(project);
    prepared.pathSegments(project, output);
    prepared.path(project);
    prepared.anchor(project);
    assert.equal(calls, 97);
  }
  let calls = 0;
  const projection = globeProjection(-1.8, .22);
  const count = prepared.trailSegments(point => { calls++; return projection(point); }, output, gradient, .9, .45);
  assert(count > 0);
  assert.equal(calls, 45);
});
