import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOBE_RADIUS, globePoint, globeProjection, prepareGlobeArc, rimIndicator, type Vec3 } from "../src/components/magicui/globe-effects";
import { createGlobeMapProjection, globeMapProjection, globeMapTransition, winkelTripel, mapSurfaceOutline, MAP_HALF_WIDTH, mapNodePose } from "../src/components/magicui/globe-map";

const surface = (lat: number, lon: number) => globePoint([lat, lon]).map(value => value * GLOBE_RADIUS) as Vec3;
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-10, `${a} ≠ ${b}`);

test("Winkel Tripel has its standard aspect ratio, curved parallels and symmetric world bounds", () => {
  const pole = winkelTripel(0, Math.PI / 2), edge = winkelTripel(Math.PI, 0);
  close(edge.x, MAP_HALF_WIDTH);
  close(edge.x / pole.y, 1 + 2 / Math.PI);
  assert(pole.y > .6);
  assert(winkelTripel(Math.PI / 2, Math.PI / 4).y > winkelTripel(0, Math.PI / 4).y);
  for (const lat of [0, 30, 60, 90]) for (const lon of [0, 45, 120, 180]) {
    const p = winkelTripel(lon * Math.PI / 180, lat * Math.PI / 180);
    const q = winkelTripel(-lon * Math.PI / 180, -lat * Math.PI / 180);
    close(p.x, -q.x); close(p.y, -q.y);
    assert(Math.abs(p.x) <= MAP_HALF_WIDTH && Math.abs(p.y) <= pole.y);
  }
});

test("The globe aligns before its surface expands, with nodes attached to geographic endpoints", () => {
  for (const [lat, lon] of [[52, 5], [-33, 151], [60, -140], [-80, 179], [0, -179]]) {
    const point = surface(lat, lon);
    const sphere = globeProjection(4.08, .22)(point);
    assert.deepEqual(globeMapProjection(4.08, .22, 0)(point), sphere);
    const flat = globeMapProjection(4.08, .22, 1)(point);
    const expected = winkelTripel(lon * Math.PI / 180, lat * Math.PI / 180);
    close(flat.x, expected.x);
    close(flat.y, expected.y);
    assert(flat.visible);
    for (const mix of [.1, .5, .9]) {
      const transition = globeMapTransition(4.08, .22, mix);
      const aligned = globeProjection(transition.phi, transition.theta)(point);
      const start = aligned.visible ? aligned : rimIndicator(aligned) ?? aligned;
      const p = globeMapProjection(4.08, .22, mix)(point);
      if (transition.unfold === 0) assert.deepEqual(p, aligned);
      else {
        close(p.x, start.x * (1 - transition.unfold) + flat.x * transition.unfold);
        close(p.y, start.y * (1 - transition.unfold) + flat.y * transition.unfold);
      }
      const node = mapNodePose(aligned, flat, transition.unfold)!;
      if (p.visible) { close(p.x, node.x); close(p.y, node.y); }
    }
  }
  const aligned = globeMapTransition(4.08, .22, .24);
  close(Math.sin(aligned.phi), -1); close(aligned.theta, 0);
  close(aligned.unfold, 0); close(aligned.surface, 1);
});

test("The projected surface expands from a round globe to the full map boundary", () => {
  const bounds = (mix: number) => {
    const outline = mapSurfaceOutline(globeMapTransition(4.08, .22, mix).unfold).flatMap(side => side.flatMap(curve => [curve.start, curve.end]));
    return { width: Math.max(...outline.map(p => p.x)) - Math.min(...outline.map(p => p.x)),
      height: Math.max(...outline.map(p => p.y)) - Math.min(...outline.map(p => p.y)) };
  };
  const globe = bounds(0), opening = bounds(.6), map = bounds(1);
  assert(Math.abs(globe.width - 1.6) < .01 && Math.abs(globe.height - 1.6) < .01);
  assert(opening.width > globe.width && opening.width < map.width);
  close(map.width, 2 * MAP_HALF_WIDTH);
  close(map.height, 2 * winkelTripel(0, Math.PI / 2).y);
});

test("The ocean boundary has continuous tangents and no visibility-driven jumps", () => {
  const globe = mapSurfaceOutline(0), map = mapSurfaceOutline(1);
  for (const unfold of [0, .01, .25, .5, .75, .99, 1]) {
    const outline = mapSurfaceOutline(unfold);
    for (const [side, curves] of outline.entries()) {
      for (const [index, curve] of curves.entries()) {
        for (const key of ["start", "control1", "control2", "end"] as const) {
          const a = globe[side][index][key], b = map[side][index][key], p = curve[key];
          close(p.x, a.x * (1 - unfold) + b.x * unfold);
          close(p.y, a.y * (1 - unfold) + b.y * unfold);
        }
        if (index > 0) {
          const previous = curves[index - 1];
          close(curve.start.x, previous.end.x); close(curve.start.y, previous.end.y);
          close(curve.control1.x - curve.start.x, previous.end.x - previous.control2.x);
          close(curve.control1.y - curve.start.y, previous.end.y - previous.control2.y);
        }
        for (const t of [.25, .5, .75]) {
          const weights = [(1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3];
          const controls = [curve.start, curve.control1, curve.control2, curve.end];
          const x = controls.reduce((sum, p, i) => sum + p.x * weights[i], 0);
          const y = controls.reduce((sum, p, i) => sum + p.y * weights[i], 0);
          const sign = side === 0 ? 1 : -1, latitude = sign * (-Math.PI / 2 + (index + t) * Math.PI / 16);
          const flat = winkelTripel(sign * Math.PI, latitude);
          const expectedX = sign * GLOBE_RADIUS * Math.cos(latitude) * (1 - unfold) + flat.x * unfold;
          const expectedY = GLOBE_RADIUS * Math.sin(latitude) * (1 - unfold) + flat.y * unfold;
          // The curve stays within a hundredth of a pixel on a 2000px canvas.
          assert(Math.hypot(x - expectedX, y - expectedY) * 960 < .01);
        }
      }
    }
  }
});

test("Far-side indicators move continuously from the rim into circular map markers", () => {
  const point = surface(35, 0), sphere = globeProjection(Math.PI / 2, .22)(point);
  const flat = globeMapProjection(0, 0, 1)(point), rim = rimIndicator(sphere)!;
  assert(!sphere.visible);
  for (const mix of [0, .001, .25, .5, .99, 1]) {
    const pose = mapNodePose(sphere, flat, mix)!;
    close(pose.x, rim.x * (1 - mix) + flat.x * mix);
    close(pose.y, rim.y * (1 - mix) + flat.y * mix);
    close(pose.rim, 1 - mix);
    close(pose.scale, 1);
  }
});

test("Land unfolds from the ocean rim while event indicators retain their outer spacing", () => {
  const point = surface(60, 130), flat = globeMapProjection(4.08, .22, 1)(point);
  for (const mix of [.3, .5, .7, .9, 1]) {
    const transition = globeMapTransition(4.08, .22, mix);
    const sphere = globeProjection(transition.phi, transition.theta)(point);
    const rim = rimIndicator(sphere, GLOBE_RADIUS)!;
    close(Math.hypot(rim.x, rim.y), GLOBE_RADIUS);
    assert(Math.hypot(rimIndicator(sphere)!.x, rimIndicator(sphere)!.y) > GLOBE_RADIUS);
    const land = globeMapProjection(4.08, .22, mix, GLOBE_RADIUS)(point);
    close(land.x, rim.x * (1 - transition.unfold) + flat.x * transition.unfold);
    close(land.y, rim.y * (1 - transition.unfold) + flat.y * transition.unfold);
  }
});

test("Routes and travelling beams split at both date-line edges without spanning the map", () => {
  for (const [from, to] of [[[20, 170], [35, -165]], [[35, -165], [20, 170]]] as [number[], number[]][]) {
    const curve = prepareGlobeArc(from as [number, number], to as [number, number]);
    for (const mix of [.8, .9, 1]) {
      const projection = globeMapProjection(Math.PI / 2, 0, mix);
      const segments = new Float32Array(768);
      const count = curve.pathSegments(projection, segments);
      const path = curve.path(projection);
      assert.equal((path.match(/M/g) ?? []).length, 2);
      assert.equal(count, 97);
      for (let i = 0; i < count; i++) assert(Math.abs(segments[i * 4] - segments[i * 4 + 2]) < 30);
      const trail = curve.trailSegments(projection, segments, new Float32Array(4), .7, .7);
      for (let i = 0; i < trail; i++) assert(Math.abs(segments[i * 4] - segments[i * 4 + 2]) < 30);
      const a = projection(surface(from[0], from[1])), b = projection(surface(to[0], to[1]));
      assert(path.startsWith(`M${(500 + a.x * 480).toFixed(2)},${(500 - a.y * 480).toFixed(2)}`));
      assert(path.endsWith(`L${(500 + b.x * 480).toFixed(2)},${(500 - b.y * 480).toFixed(2)} `));
    }
  }
});

test("Retained map coordinates preserve route, trail and date-line geometry across camera changes", () => {
  const routes = [prepareGlobeArc([20, 170], [35, -165]), prepareGlobeArc([-33, 151], [52, 5])];
  const project = createGlobeMapProjection(routes.flatMap(route => route.points));
  const buffer = new Float32Array(768), reference = new Float32Array(768);
  const gradient = new Float32Array(4), referenceGradient = new Float32Array(4);
  for (const mix of [0, .2, .6, 1, .8, .3, 0, 1]) for (const phi of [0, 4.08, -2]) {
    const cached = project(phi, -.7, mix), expected = globeMapProjection(phi, -.7, mix);
    for (const route of routes) {
      assert.equal(route.path(cached), route.path(expected));
      assert.equal(route.pathSegments(cached, buffer), route.pathSegments(expected, reference));
      assert.deepEqual(buffer, reference);
      for (const phase of [.35, .35, .91, .35]) {
        const count = route.trailSegments(cached, buffer, gradient, phase, .45);
        assert.equal(count, route.trailSegments(expected, reference, referenceGradient, phase, .45));
        assert.deepEqual(buffer.slice(0, count * 4), reference.slice(0, count * 4));
        assert.deepEqual(gradient, referenceGradient);
        assert.equal(route.arrow(cached, phase), route.arrow(expected, phase));
      }
    }
  }
});

test("Map coordinate caching leaves moving samples live and preserves antimeridian cuts", () => {
  const fixed = surface(25, 30), moving = surface(-30, 160);
  const cached = createGlobeMapProjection([fixed])(0, .22, 1), direct = globeMapProjection(0, .22, 1);
  assert.deepEqual(cached(fixed), direct(fixed));
  const before = cached(moving);
  moving.splice(0, 3, ...surface(40, -150));
  assert.deepEqual(cached(moving), direct(moving));
  assert.notDeepEqual(cached(moving), before);
  const meridians = [-180, -170, -90, -1, -0, 0, 1, 90, 170, 180];
  for (const longitude of meridians) for (const other of meridians) {
    const a = surface(20, longitude), b = surface(-30, other);
    const separated = Math.abs(Math.atan2(-a[2], a[0]) - Math.atan2(-b[2], b[0])) > Math.PI;
    assert.equal(!!cached.split!(a, b), separated);
  }
});
