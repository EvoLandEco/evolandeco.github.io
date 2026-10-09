type Vec3 = [number, number, number];
export const GLOBE_RADIUS = 0.8;
export function globePoint([lat, lon]: [number, number]): Vec3 {
  const a = (lat * Math.PI) / 180,
    b = (lon * Math.PI) / 180 - Math.PI;
  return [-Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
}
export function globeProjection(phi: number, theta: number) {
  const cp = Math.cos(phi), sp = Math.sin(phi), ct = Math.cos(theta), st = Math.sin(theta);
  return (p: Vec3) => {
    const x = cp * p[0] + sp * p[2];
    const y =
      sp * st * p[0] +
      ct * p[1] -
      cp * st * p[2];
    const z =
      -sp * ct * p[0] +
      st * p[1] +
      cp * ct * p[2];
    return {
      x,
      y,
      z,
      visible: z >= 0 || x * x + y * y >= GLOBE_RADIUS * GLOBE_RADIUS,
    };
  };
}
export function projectPoint(p: Vec3, phi: number, theta: number) {
  return globeProjection(phi, theta)(p);
}
export function rimIndicator(point: ReturnType<typeof projectPoint>) {
  const distance = Math.hypot(point.x, point.y);
  // The rear antipode has no screen bearing.
  if (point.z >= 0 || distance < Number.EPSILON) return null;
  const radius = GLOBE_RADIUS + .035;
  return {
    x: point.x / distance * radius,
    y: point.y / distance * radius,
    angle: Math.atan2(point.y, -point.x) * 180 / Math.PI,
    opacity: Math.min(1, -point.z / .08),
  };
}

function quadraticArc(from: Vec3, to: Vec3, lift: number) {
  const sum = from.map((v, i) => v + to[i]);
  const length = Math.hypot(...sum);
  const r = GLOBE_RADIUS;
  return (t: number, bend?: Vec3) => from.map(
    (v, i) =>
      (1 - t) ** 2 * r * v +
      (2 * (1 - t) * t * (r + lift) * sum[i]) / length +
      t * t * r * to[i] + 2 * (1 - t) * t * (bend?.[i] ?? 0),
  ) as Vec3;
}

export function arcPoint(from: Vec3, to: Vec3, t: number, lift = 0.4, bend?: Vec3): Vec3 {
  return quadraticArc(from, to, lift)(t, bend);
}

export function drawGlobeEffects(
  canvas: HTMLCanvasElement,
  locations: [number, number][],
  phi: number,
  time: number,
  dark: boolean,
  theta = 0.22,
  highlighted = -1,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width,
    scale = (width * 0.96) / 2;
  const points = locations.map(globePoint);
  const projection = globeProjection(phi, theta);
  const project = (p: Vec3) => {
    const v = projection(p);
    return {
      x: width / 2 + v.x * scale,
      y: width / 2 - v.y * scale,
      visible: v.visible,
    };
  };
  ctx.clearRect(0, 0, width, width);
  ctx.lineCap = "round";
  ctx.shadowBlur = 0;
  for (const [index, normal] of points.entries()) {
    const center = project(normal.map((v) => v * GLOBE_RADIUS) as Vec3);
    if (!center.visible) continue;
    const length = Math.hypot(normal[0], normal[2]);
    const u: Vec3 =
      length === 0 ? [1, 0, 0] : [-normal[2] / length, 0, normal[0] / length];
    const v: Vec3 = [
      normal[1] * u[2] - normal[2] * u[1],
      normal[2] * u[0] - normal[0] * u[2],
      normal[0] * u[1] - normal[1] * u[0],
    ];
    const breath = 0.5 + 0.5 * Math.sin(time / 450 + index * 0.7);
    const pulse = (time / 1900 + index * 0.19) % 1;
    const blue = dark ? "108,200,255" : "24,105,227";
    // Surface rings share the node normal and foreshorten with the globe.
    const ring = (radius: number, start = 0, end = Math.PI * 2) => {
      radius *= index === highlighted ? 1.35 : 1;
      ctx.beginPath();
      let connected = false;
      for (let j = 0; j <= 64; j++) {
        const a = start + j / 64 * (end - start);
        const surface = normal.map((n, k) => GLOBE_RADIUS *
          (n * Math.cos(radius) + (u[k] * Math.cos(a) + v[k] * Math.sin(a)) * Math.sin(radius))) as Vec3;
        const p = project(surface);
        if (!p.visible) { connected = false; continue; }
        if (connected) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        connected = true;
      }
    };
    ctx.shadowColor = dark ? "#54cfff" : "#397fff";
    // A broad low-opacity halo gives the crisp core room to shine.
    ring(0.075 + breath * 0.018);
    ctx.fillStyle = `rgba(${blue},${0.1 + breath * 0.08})`;
    ctx.shadowBlur = width * 0.024;
    ctx.fill();
    ring(0.055 + pulse * 0.1);
    ctx.strokeStyle = `rgba(${blue},${(1-pulse)**2 * 0.65})`;
    ctx.lineWidth = width * 0.0022;
    ctx.shadowBlur = width * 0.008;
    ctx.stroke();
    ring(0.058);
    ctx.strokeStyle = `rgba(${blue},0.65)`;
    ctx.lineWidth = width * 0.002;
    ctx.stroke();
    const rotation = time / 950 + index;
    for (let segment = 0; segment < 3; segment++) {
      const start = rotation + segment * Math.PI * 2 / 3;
      ring(0.095, start, start + Math.PI * 0.43);
      ctx.strokeStyle = `rgba(${blue},0.72)`;
      ctx.lineWidth = width * 0.0028;
      ctx.stroke();
    }
    ring(0.027 + breath * 0.003);
    ctx.fillStyle = `rgba(${blue},0.98)`;
    ctx.shadowBlur = width * (0.012 + breath * 0.018);
    ctx.fill();
    ring(0.012);
    ctx.fillStyle = dark ? "#e5fbff" : "#fff";
    ctx.shadowBlur = width * 0.01;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export function geographicArc(from: Vec3, to: Vec3) {
  const chord = to.map((v, i) => v - from[i]) as Vec3;
  const distance = Math.hypot(...chord);
  const lift = Math.max(.32, Math.min(.4, distance * .35));
  const quadratic = quadraticArc(from, to, lift);
  if (distance >= .4) return quadratic;
  const midpoint = from.map((v, i) => (v + to[i]) * GLOBE_RADIUS / 2);
  const midpointRadius = Math.hypot(...midpoint);
  const normal = midpoint.map(v => v / midpointRadius);
  const tangent = distance ? chord.map(v => v / distance) :
    (Math.abs(from[1]) < .9 ? [-from[2], 0, from[0]] : [0, -from[2], from[1]]);
  const tangentLength = Math.hypot(...tangent);
  const halfChord = distance * GLOBE_RADIUS / 2;
  const height = GLOBE_RADIUS - midpointRadius + .08 + distance * .15;
  const radius = (height * height + halfChord * halfChord) / (2 * height);
  const sweep = 2 * Math.atan2(height, halfChord);
  const blend = Math.max(0, (distance - .2) / .2);
  const weight = blend * blend * (3 - 2 * blend);
  // A circular arc taller than its half-chord sweeps outward at both ends.
  return (t: number, bend?: Vec3): Vec3 => {
    if (t === 0 || t === 1) return (t === 0 ? from : to).map(v => v * GLOBE_RADIUS) as Vec3;
    const angle = (2 * t - 1) * sweep;
    const base = weight ? quadratic(t) : midpoint;
    return midpoint.map((v, i) => {
      const circle = v + normal[i] * (height - radius + radius * Math.cos(angle)) +
        tangent[i] / tangentLength * radius * Math.sin(angle);
      return circle * (1 - weight) + base[i] * weight + 2 * (1 - t) * t * (bend?.[i] ?? 0);
    }) as Vec3;
  };
}

export function separateGlobeRoutes(routes: { id: string; from: [number, number]; to: [number, number] }[]): Vec3[] {
  const curves = routes.map(route => {
    const a = globePoint(route.from), b = globePoint(route.to);
    const pointAt = geographicArc(a, b);
    const points = Array.from({ length: 11 }, (_, i) => pointAt(i / 10));
    const normal: Vec3 = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dominant = normal.reduce((best, v, i) => Math.abs(v) > Math.abs(normal[best]) ? i : best, 0);
    const length = Math.hypot(...normal);
    const direction = normal.map(v => length === 0 ? 0 : v / length * Math.sign(normal[dominant])) as Vec3;
    const tangents = points.slice(1, -1).map((_, i) => {
      const delta = points[i + 2].map((v, k) => v - points[i][k]);
      const size = Math.hypot(...delta);
      return delta.map(v => v / size);
    });
    return { path: points, points: points.slice(1, -1), tangents, direction };
  });
  const neighbours = routes.map(() => new Set<number>());
  // ponytail: pairwise curve checks suit small maps; use a spatial index for hundreds of routes.
  for (let i = 0; i < routes.length; i++) for (let j = 0; j < i; j++) {
    const a = curves[i], b = curves[j];
    let close = 0;
    for (let k = 0; k < a.points.length && close < 2; k++) {
      const point = a.points[k], tangent = a.tangents[k];
      for (let n = 0; n < b.points.length; n++) {
        const other = b.points[n], direction = b.tangents[n];
        if (Math.hypot(point[0] - other[0], point[1] - other[1], point[2] - other[2]) < .075 &&
            Math.abs(tangent[0] * direction[0] + tangent[1] * direction[1] + tangent[2] * direction[2]) > Math.cos(Math.PI / 9)) {
          close++;
          break;
        }
      }
    }
    if (close === 2) { neighbours[i].add(j); neighbours[j].add(i); }
  }
  const laneLimits = new Map<number, { count: number; step: number }>();
  for (let i = 0; i < routes.length; i++) {
    if (laneLimits.has(i)) continue;
    const component = new Set([i]);
    for (const j of component) for (const neighbour of neighbours[j]) component.add(neighbour);
    const degree = Math.max(...[...component].map(j => neighbours[j].size));
    const half = Math.ceil((degree + 1) / 2);
    // More lanes than neighbours guarantees a free lane inside a fixed-width corridor.
    const limit = { count: 2 * half + 1, step: Math.min(.18, .36 / half) };
    for (const j of component) laneLimits.set(j, limit);
  }
  const lanes = new Map<number, number>();
  const lanePaths = routes.map(() => new Map<number, number[][]>());
  const lanePath = (i: number, lane: number) => {
    const known = lanePaths[i].get(lane);
    if (known) return known;
    const path = curves[i].path.map((point, n) => {
      const t = n / 10;
      return point.map((v, axis) => v + 2 * (1 - t) * t * curves[i].direction[axis] * lane * laneLimits.get(i)!.step);
    });
    lanePaths[i].set(lane, path);
    return path;
  };
  const crossings = (i: number, lane: number, j: number) => {
    const a = lanePath(i, lane), b = lanePath(j, lanes.get(j)!);
    // Compare the routes from the centre of their geographic region.
    const normal = curves[i].points[4].map((v, axis) => v + curves[j].points[4][axis]);
    const side = (p: number[], q: number[], r: number[]) => {
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2];
      const vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      return (uy * vz - uz * vy) * normal[0] +
        (uz * vx - ux * vz) * normal[1] + (ux * vy - uy * vx) * normal[2];
    };
    let count = 0;
    for (let k = 1; k < a.length; k++) for (let n = 1; n < b.length; n++) {
      if (side(a[k - 1], a[k], b[n - 1]) * side(a[k - 1], a[k], b[n]) < 0 &&
          side(b[n - 1], b[n], a[k - 1]) * side(b[n - 1], b[n], a[k]) < 0) count++;
    }
    return count;
  };
  const order = routes.map((route, i) => ({ id: route.id, i })).sort((a, b) => a.id.localeCompare(b.id));
  for (const { i } of order) {
    const placed = [...neighbours[i]].filter(j => lanes.has(j));
    const occupied = new Set(placed.map(j => lanes.get(j)));
    const { count, step } = laneLimits.get(i)!;
    const candidates = Array.from({ length: count }, (_, n) => n % 2 ? (n + 1) / 2 : -n / 2).filter(lane => !occupied.has(lane));
    const clearance = (lane: number) => Math.min(...placed.map(j => Math.hypot(...curves[i].points[4].map((v, axis) =>
      v + curves[i].direction[axis] * lane * step / 2 - curves[j].points[4][axis] - curves[j].direction[axis] * lanes.get(j)! * step / 2))));
    const ranked = candidates.map(lane => ({ lane, crosses: placed.reduce((count, j) => count + crossings(i, lane, j), 0), clearance: clearance(lane) }));
    ranked.sort((a, b) => a.crosses - b.crosses || Math.abs(a.lane) - Math.abs(b.lane) || b.clearance - a.clearance);
    lanes.set(i, ranked[0].lane);
  }
  return curves.map((curve, i) => curve.direction.map(v => v * lanes.get(i)! * laneLimits.get(i)!.step) as Vec3);
}

const anchorSamples = Array.from({ length: 97 }, (_, i) => i)
  .sort((a, b) => Math.abs(a / 96 - .5) - Math.abs(b / 96 - .5));

export function prepareGlobeArc(from: [number, number], to: [number, number], geographic = true, bend?: Vec3) {
  const a = globePoint(from), b = globePoint(to);
  const curve = geographic ? geographicArc(a, b) : quadraticArc(a, b, .4);
  const pointAt = (t: number) => curve(t, bend);
  const points = Array.from({ length: 97 }, (_, i) => pointAt(i / 96));
  type Projection = ReturnType<typeof globeProjection>;
  type ProjectedPoint = ReturnType<Projection>;
  let sampledProjection: Projection | undefined;
  let samples: ProjectedPoint[] = [];
  function path(project: Projection, start?: number, end?: number, tail?: ProjectedPoint, head?: ProjectedPoint): string;
  function path(project: Projection, start: number, end: number, tail: ProjectedPoint | undefined, head: ProjectedPoint | undefined, output: Float32Array): number;
  function path(project: Projection, start = 0, end = 1, tail?: ProjectedPoint, head?: ProjectedPoint, output?: Float32Array) {
    let path = "", connected = false, count = 0, x = 0, y = 0;
    const full = start === 0 && end === 1;
    if (full && sampledProjection !== project) {
      samples = points.map(project);
      sampledProjection = project;
    }
    const steps = Math.max(1, Math.ceil(96 * (end - start)));
    for (let i = 0; i <= steps; i++) {
      let p: ProjectedPoint;
      if (full) p = samples[i];
      else {
        const t = start + (end - start) * i / steps;
        p = i === 0 && tail ? tail : i === steps && t === end && head ? head : project(pointAt(t));
      }
      if (!p.visible) { connected = false; continue; }
      const nextX = 500 + p.x * 480, nextY = 500 - p.y * 480;
      if (output) {
        if (connected) {
          const offset = count++ * 4;
          output[offset] = x; output[offset + 1] = y;
          output[offset + 2] = nextX; output[offset + 3] = nextY;
        }
      } else path += `${connected ? "L" : "M"}${nextX.toFixed(2)},${nextY.toFixed(2)} `;
      x = nextX; y = nextY;
      connected = true;
    }
    return output ? count : path;
  }
  function trail(project: Projection, progress: number, length?: number): { path: string; x1: number; y1: number; x2: number; y2: number };
  function trail(project: Projection, progress: number, length: number, output: Float32Array, gradient: Float32Array): number;
  function trail(project: Projection, progress: number, length = .22, output?: Float32Array, gradient?: Float32Array) {
    const start = Math.min(1, Math.max(0, progress - length));
    const end = Math.min(1, Math.max(0, progress));
    const tail = project(pointAt(start)), head = project(pointAt(end));
    // The path stops at the destination while its gradient continues past it.
    const beyond = end > start ? Math.max(0, progress - end) / (end - start) : 0;
    const x1 = 500 + tail.x * 480, y1 = 500 - tail.y * 480;
    const x2 = 500 + (head.x + (head.x - tail.x) * beyond) * 480;
    const y2 = 500 - (head.y + (head.y - tail.y) * beyond) * 480;
    if (output && gradient) {
      gradient[0] = x1; gradient[1] = y1; gradient[2] = x2; gradient[3] = y2;
      return end > start ? path(project, start, end, tail, head, output) : 0;
    }
    return { path: end > start ? path(project, start, end, tail, head) : "", x1, y1, x2, y2 };
  }
  function arrow(project: Projection, progress?: number): string;
  function arrow(project: Projection, progress: number, output: Float32Array): number;
  function arrow(project: Projection, progress = .91, output?: Float32Array): string | number {
    const tip = project(pointAt(progress)), tail = project(pointAt(Math.max(0, progress - .01)));
    if (!tip.visible || !tail.visible) return output ? 0 : "";
    const x = 500 + tip.x * 480, y = 500 - tip.y * 480;
    const dx = tip.x - tail.x, dy = tail.y - tip.y;
    const length = Math.hypot(dx, dy);
    if (!length) return output ? 0 : "";
    const ux = dx / length, uy = dy / length;
    const x1 = x - ux * 13 - uy * 6, y1 = y - uy * 13 + ux * 6;
    const x2 = x - ux * 13 + uy * 6, y2 = y - uy * 13 - ux * 6;
    if (output) {
      output[0] = x1; output[1] = y1; output[2] = x; output[3] = y;
      output[4] = x; output[5] = y; output[6] = x2; output[7] = y2;
      return 2;
    }
    return `M${x1},${y1} L${x},${y} L${x2},${y2}`;
  }
  return {
    path,
    pathSegments(project: Projection, output: Float32Array, start = 0, end = 1) {
      return path(project, start, end, undefined, undefined, output);
    },
    anchor(project: Projection) {
      for (const i of anchorSamples) {
        const point = sampledProjection === project ? samples[i] : project(points[i]);
        if (point.visible) return point;
      }
      return null;
    },
    trail,
    trailSegments(project: Projection, output: Float32Array, gradient: Float32Array, progress: number, length = .22) {
      return trail(project, progress, length, output, gradient);
    },
    arrow,
    arrowSegments(project: Projection, output: Float32Array, progress = .91) {
      return arrow(project, progress, output);
    },
  };
}

export function projectArcPath(from: [number, number], to: [number, number], phi: number, geographic = false, theta = .22, bend?: Vec3, range: [number, number] = [0, 1]) {
  return prepareGlobeArc(from, to, geographic, bend).path(globeProjection(phi, theta), ...range);
}
export function projectArcAnchor(from: [number, number], to: [number, number], phi: number, theta: number, bend?: Vec3) {
  return prepareGlobeArc(from, to, true, bend).anchor(globeProjection(phi, theta));
}
export function projectArcTrail(from: [number, number], to: [number, number], phi: number, theta: number, bend: Vec3 | undefined, progress: number, length = .22) {
  return prepareGlobeArc(from, to, true, bend).trail(globeProjection(phi, theta), progress, length);
}
export function projectArcArrow(from: [number, number], to: [number, number], phi: number, theta = .22, bend?: Vec3, progress = .91) {
  return prepareGlobeArc(from, to, true, bend).arrow(globeProjection(phi, theta), progress);
}


export function globeLocationCenter(locations: [number, number][]): [number, number] | undefined {
  const sum: Vec3 = [0, 0, 0];
  for (const location of locations) {
    const point = globePoint(location);
    for (let axis = 0; axis < 3; axis++) sum[axis] += point[axis];
  }
  // Opposing directions have no mean beyond floating point roundoff.
  if (Math.hypot(...sum) <= locations.length * Number.EPSILON || !locations.length) return;
  return [Math.atan2(sum[1], Math.hypot(sum[0], sum[2])) * 180 / Math.PI, Math.atan2(-sum[2], sum[0]) * 180 / Math.PI];
}

export function focusOrientation(location: [number, number], phi: number) {
  const target = -Math.PI / 2 - location[1] * Math.PI / 180;
  const turn = Math.atan2(Math.sin(target - phi), Math.cos(target - phi));
  return { phi: phi + turn, theta: location[0] * Math.PI / 180 };
}
