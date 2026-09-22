type Vec3 = [number, number, number];
export const GLOBE_RADIUS = 0.8;
export function globePoint([lat, lon]: [number, number]): Vec3 {
  const a = (lat * Math.PI) / 180,
    b = (lon * Math.PI) / 180 - Math.PI;
  return [-Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
}
export function projectPoint(p: Vec3, phi: number, theta: number) {
  const x = Math.cos(phi) * p[0] + Math.sin(phi) * p[2];
  const y =
    Math.sin(phi) * Math.sin(theta) * p[0] +
    Math.cos(theta) * p[1] -
    Math.cos(phi) * Math.sin(theta) * p[2];
  const z =
    -Math.sin(phi) * Math.cos(theta) * p[0] +
    Math.sin(theta) * p[1] +
    Math.cos(phi) * Math.cos(theta) * p[2];
  return {
    x,
    y,
    visible: z >= 0 || x * x + y * y >= GLOBE_RADIUS * GLOBE_RADIUS,
  };
}
export function arcPoint(from: Vec3, to: Vec3, t: number): Vec3 {
  const sum = from.map((v, i) => v + to[i]);
  const length = Math.hypot(...sum);
  const r = GLOBE_RADIUS;
  return from.map(
    (v, i) =>
      (1 - t) ** 2 * r * v +
      (2 * (1 - t) * t * (r + 0.4) * sum[i]) / length +
      t * t * r * to[i],
  ) as Vec3;
}

export function drawGlobeEffects(
  canvas: HTMLCanvasElement,
  locations: [number, number][],
  phi: number,
  time: number,
  dark: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width,
    scale = (width * 0.96) / 2;
  const points = locations.map(globePoint);
  const project = (p: Vec3) => {
    const v = projectPoint(p, phi, 0.22);
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

export function projectArcPath(
  from: [number, number],
  to: [number, number],
  phi: number,
) {
  const a = globePoint(from),
    b = globePoint(to);
  let path = "",
    connected = false;
  for (let i = 0; i <= 96; i++) {
    const p = projectPoint(arcPoint(a, b, i / 96), phi, 0.22);
    if (!p.visible) {
      connected = false;
      continue;
    }
    path += `${connected ? "L" : "M"}${(500 + p.x * 480).toFixed(2)},${(500 - p.y * 480).toFixed(2)} `;
    connected = true;
  }
  return path;
}
