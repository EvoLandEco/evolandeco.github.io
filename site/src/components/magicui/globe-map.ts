import { GLOBE_RADIUS, globePoint, globeProjection, rimIndicator, type GlobeProjection, type Vec3 } from "./globe-effects";

export const MAP_HALF_WIDTH = .99;
const WINKEL_SCALE = MAP_HALF_WIDTH / (Math.PI / 2 + 1);
const ease = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// Winkel Tripel uses the standard parallel acos(2 / pi).
export function winkelTripel(longitude: number, latitude: number) {
  const cosine = Math.cos(latitude);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cosine * Math.cos(longitude / 2))));
  const sinc = alpha === 0 ? 1 : Math.sin(alpha) / alpha;
  return {
    x: (cosine * Math.sin(longitude / 2) / sinc + longitude / Math.PI) * WINKEL_SCALE,
    y: (Math.sin(latitude) / sinc + latitude) / 2 * WINKEL_SCALE,
  };
}

export function globeMapTransition(phi: number, theta: number, mix: number) {
  const align = ease(mix / .24);
  const turn = Math.atan2(Math.sin(-Math.PI / 2 - phi), Math.cos(-Math.PI / 2 - phi));
  return { phi: phi + turn * align, theta: theta * (1 - align),
    unfold: ease((mix - .24) / .76), surface: ease(mix / .2) };
}

function mapCoordinates(point: Vec3) {
  const longitude = Math.atan2(-point[2], point[0]);
  const latitude = Math.atan2(point[1], Math.hypot(point[0], point[2]));
  const flat = winkelTripel(longitude, latitude);
  return { longitude, latitude, x: flat.x, y: flat.y + (Math.hypot(...point) - GLOBE_RADIUS) * .32 };
}

// Only fixed geometry keeps map coordinates between camera frames.
export function createGlobeMapProjection(geometry: Iterable<Vec3>) {
  const retained = new WeakSet(geometry);
  const coordinates = new WeakMap<Vec3, ReturnType<typeof mapCoordinates>>();
  const flat = (point: Vec3) => {
    let value = coordinates.get(point);
    if (!value) { value = mapCoordinates(point); if (retained.has(point)) coordinates.set(point, value); }
    return value;
  };
  return (phi: number, theta: number, mix: number, rimRadius?: number) => globeMapProjection(phi, theta, mix, rimRadius, flat);
}

export function globeMapProjection(phi: number, theta: number, mix: number, rimRadius?: number, coordinates = mapCoordinates): GlobeProjection {
  const transition = globeMapTransition(phi, theta, mix);
  const sphere = globeProjection(transition.phi, transition.theta);
  const blend = transition.unfold;
  if (blend === 0) return sphere;
  const project = (point: Vec3, edgeLongitude?: number) => {
    const flat = coordinates(point);
    const edge = edgeLongitude === undefined ? flat : winkelTripel(edgeLongitude, flat.latitude);
    const x = edge.x, y = edgeLongitude === undefined ? flat.y : edge.y + (Math.hypot(...point) - GLOBE_RADIUS) * .32;
    if (blend === 1) return { x, y, z: GLOBE_RADIUS, visible: true };
    const spherical = sphere(point);
    const start = spherical.visible ? spherical : rimIndicator(spherical, rimRadius) ?? spherical;
    const z = spherical.z * (1 - blend) + GLOBE_RADIUS * blend;
    return { x: start.x * (1 - blend) + x * blend, y: start.y * (1 - blend) + y * blend,
      z, visible: spherical.visible || z >= 0 };
  };
  const projection: GlobeProjection = point => project(point);
  projection.split = (from, to) => {
    if ((from[2] > 0 && to[2] > 0) || (from[2] < 0 && to[2] < 0)) return null;
    const a = Math.atan2(-from[2], from[0]), b = Math.atan2(-to[2], to[0]);
    if (Math.abs(a - b) <= Math.PI) return null;
    // Cut at the antimeridian plane, retaining both copies of the map edge.
    const t = from[2] / (from[2] - to[2]);
    const edge = from.map((value, axis) => value + (to[axis] - value) * t) as Vec3;
    return [project(edge, Math.sign(a) * Math.PI), project(edge, Math.sign(b) * Math.PI)];
  };
  return projection;
}

export function mapNodePose(sphere: ReturnType<GlobeProjection>, end: ReturnType<GlobeProjection>, mix: number) {
  const rim = sphere.visible ? null : rimIndicator(sphere);
  const start = sphere.visible ? sphere : rim;
  if (!start && mix === 0) return null;
  const rotation = sphere.visible ? Math.atan2(-sphere.y, sphere.x) : (rim?.angle ?? 0) * Math.PI / 180;
  return {
    x: (start?.x ?? sphere.x) * (1 - mix) + end.x * mix,
    y: (start?.y ?? sphere.y) * (1 - mix) + end.y * mix,
    rotation: rotation * (1 - mix),
    scale: (sphere.visible ? Math.abs(sphere.z) / GLOBE_RADIUS : 1) * (1 - mix) + mix,
    rim: sphere.visible ? 0 : 1 - mix,
    opacity: (rim?.opacity ?? (start ? 1 : 0)) * (1 - mix) + mix,
  };
}

let land: Promise<Vec3[]> | undefined;
export function globeMapLand() {
  return land ??= import("svg-dotted-map").then(({ createMap }) => {
    const points: Vec3[] = [];
    // Latitude rows keep a constant angular spacing on the sphere.
    for (let latitude = -84; latitude <= 84; latitude += 1.5) {
      const columns = Math.round(240 * Math.cos(latitude * Math.PI / 180));
      const row = createMap({ width: columns, height: 2, radius: 0, mapSamples: columns * 2,
        region: { lng: { min: -180, max: 180 }, lat: { min: latitude - 1, max: latitude } },
      }).points;
      for (const { x, y } of row) if (y === 0) {
        points.push(globePoint([latitude, x / columns * 360 - 180]).map(value => value * GLOBE_RADIUS) as Vec3);
      }
    }
    return points;
  });
}

type Point = { x: number; y: number };
type SurfaceCurve = { start: Point; control1: Point; control2: Point; end: Point };

export function mapSurfaceOutline(unfold: number): SurfaceCurve[][] {
  // Corresponding latitudes join the globe's limb to the Winkel antimeridian.
  const horizontal = GLOBE_RADIUS * (1 - unfold) + Math.PI / 2 * WINKEL_SCALE * unfold;
  const vertical = GLOBE_RADIUS * (1 - unfold) + Math.PI / 4 * WINKEL_SCALE * unfold;
  const offset = WINKEL_SCALE * unfold;
  const step = Math.PI / 16;
  return [1, -1].map(side => {
    const point = (latitude: number) => ({ x: side * (horizontal * Math.cos(latitude) + offset),
      y: vertical * Math.sin(latitude) + offset * latitude / 2 });
    const tangent = (latitude: number) => ({ x: -side * horizontal * Math.sin(latitude),
      y: vertical * Math.cos(latitude) + offset / 2 });
    return Array.from({ length: 16 }, (_, index) => {
      const a = side * (-Math.PI / 2 + index * step), b = a + side * step;
      const start = point(a), end = point(b), da = tangent(a), db = tangent(b), h = (b - a) / 3;
      return { start, control1: { x: start.x + h * da.x, y: start.y + h * da.y },
        control2: { x: end.x - h * db.x, y: end.y - h * db.y }, end };
    });
  });
}

export function drawGlobeMap(canvas: HTMLCanvasElement, land: Vec3[], phi: number, theta: number, mix: number, dark: boolean, projection = globeMapProjection) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  ctx.clearRect(0, 0, width, width);
  if (!mix) return;
  const project = projection(phi, theta, mix, GLOBE_RADIUS);
  const transition = globeMapTransition(phi, theta, mix);
  const scale = width * .48;
  const dot = width * .0015;
  ctx.globalAlpha = transition.surface;
  ctx.beginPath();
  const pixel = (point: Point) => ({ x: width / 2 + point.x * scale, y: width / 2 - point.y * scale });
  for (const [index, curves] of mapSurfaceOutline(transition.unfold).entries()) {
    const start = pixel(curves[0].start);
    if (index === 0) ctx.moveTo(start.x, start.y); else ctx.lineTo(start.x, start.y);
    for (const curve of curves) {
      const a = pixel(curve.control1), b = pixel(curve.control2), end = pixel(curve.end);
      ctx.bezierCurveTo(a.x, a.y, b.x, b.y, end.x, end.y);
    }
  }
  ctx.closePath();
  const shade = ctx.createRadialGradient(width * .42, width * .35, 0, width * .5, width * .5, width * .48);
  const depth = 1 - transition.unfold;
  shade.addColorStop(0, dark ? `rgba(53,74,103,${.15 + depth * .7})` : `rgba(233,240,248,${.18 + depth * .65})`);
  shade.addColorStop(1, dark ? `rgba(95,133,166,${.06 + depth * .4})` : `rgba(197,215,233,${.1 + depth * .25})`);
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.strokeStyle = dark ? "rgba(133,173,201,.12)" : "rgba(104,142,167,.12)";
  ctx.lineWidth = width / 1600;
  ctx.stroke();
  ctx.fillStyle = dark ? "#8da8c5" : "#8299ac";
  ctx.globalAlpha = transition.surface * (dark ? .7 : .6);
  ctx.beginPath();
  for (const point of land) {
    const p = project(point);
    if (!p.visible) continue;
    const x = width / 2 + p.x * scale, y = width / 2 - p.y * scale;
    ctx.moveTo(x + dot, y);
    ctx.arc(x, y, dot, 0, 2 * Math.PI);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}
