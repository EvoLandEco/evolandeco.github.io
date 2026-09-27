import { createMap } from "svg-dotted-map";

type Coordinate = { longitude: number; latitude: number };
const degrees = 180 / Math.PI;
const wrap = (value: number) => ((value % 360) + 360) % 360;
const mercator = (latitude: number) => Math.log(Math.tan((90 + Math.max(-85, Math.min(85, latitude))) / degrees / 2)) * degrees;
const latitude = (y: number) => (2 * Math.atan(Math.exp(y / degrees)) - Math.PI / 2) * degrees;

export function fitChainMap(points: Coordinate[], width = 720, height = 340, padding = { x: 80, y: 70 }) {
  if (!points.length) return null;
  const longitudes = points.map(p => wrap(p.longitude)).sort((a, b) => a - b);
  let gap = -1, start = longitudes[0];
  for (let i = 0; i < longitudes.length; i++) {
    const next = longitudes[(i + 1) % longitudes.length] + (i === longitudes.length - 1 ? 360 : 0);
    if (next - longitudes[i] > gap) { gap = next - longitudes[i]; start = longitudes[(i + 1) % longitudes.length]; }
  }
  // Cutting at the largest empty longitude interval keeps date-line routes together.
  const unwrap = (longitude: number) => { const value = wrap(longitude); return value < start ? value + 360 : value; };
  const xs = points.map(p => unwrap(p.longitude)), ys = points.map(p => mercator(p.latitude));
  const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
  const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = Math.max((Math.max(...xs) - Math.min(...xs)) / (width - 2 * padding.x), (Math.max(...ys) - Math.min(...ys)) / (height - 2 * padding.y), 12 / height);
  const west = centerX - width * scale / 2, east = centerX + width * scale / 2;
  const south = Math.max(mercator(-85), centerY - height * scale / 2), north = Math.min(mercator(85), centerY + height * scale / 2);
  const project = (p: Coordinate) => ({ x: width / 2 + (unwrap(p.longitude) - centerX) / scale, y: height / 2 - (mercator(p.latitude) - centerY) / scale });
  return { width, height, west, east, south, north, scale, centerY, project };
}

export function chainLandDots(frame: NonNullable<ReturnType<typeof fitChainMap>>) {
  const { west, east, south, north, scale, height, centerY } = frame;
  const dots: { x: number; y: number }[] = [];
  // Each world copy is sampled in its own longitude interval, then placed in the fitted view.
  for (let copy = Math.floor((west + 180) / 360); copy <= Math.floor((east + 180) / 360); copy++) {
    const left = Math.max(west, -180 + 360 * copy), right = Math.min(east, 180 + 360 * copy);
    if (right <= left) continue;
    const w = (right - left) / scale, h = (north - south) / scale;
    const { points } = createMap({ width: w, height: h, radius: 0, mapSamples: Math.max(4, Math.round(w * h / 42)), region: {
      lng: { min: left - 360 * copy, max: right - 360 * copy }, lat: { min: latitude(south), max: latitude(north) },
    } });
    for (const p of points) dots.push({ x: p.x + (left - west) / scale, y: p.y + height / 2 - (north - centerY) / scale });
  }
  return dots.map(p => `M${p.x.toFixed(2)} ${p.y.toFixed(2)}h.01`).join("");
}

type MapPoint = { x: number; y: number };

export function chainEdgeGeometry(a: MapPoint, b: MapPoint) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (!length) return null;
  const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length;
  // Leave room beyond the node halos for the arrowhead.
  const clearance = 30;
  const bend = Math.max(Math.min(36, length * .12), 2 * Math.sqrt(Math.max(0, clearance ** 2 - (length / 2) ** 2)));
  const apex = { x: (a.x + b.x) / 2 + dy * bend, y: (a.y + b.y) / 2 - dx * bend };
  const point = (t: number) => ({
    x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * apex.x + t ** 2 * b.x,
    y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * apex.y + t ** 2 * b.y,
  });
  const trim = (node: MapPoint, radius: number, reverse: boolean) => {
    let low = 0, high = .5;
    for (let i = 0; i < 32; i++) {
      const middle = (low + high) / 2, p = point(reverse ? 1 - middle : middle);
      if (Math.hypot(p.x - node.x, p.y - node.y) < radius) low = middle;
      else high = middle;
    }
    return reverse ? 1 - high : high;
  };
  const from = trim(a, 17, false), to = trim(b, 19, true);
  const start = point(from), end = point(to);
  const control = {
    x: start.x + (to - from) * ((1 - from) * (apex.x - a.x) + from * (b.x - apex.x)),
    y: start.y + (to - from) * ((1 - from) * (apex.y - a.y) + from * (b.y - apex.y)),
  };
  return { start, end, control, path: `M${start.x} ${start.y}Q${control.x} ${control.y} ${end.x} ${end.y}` };
}

export function chainBadgePosition(point: MapPoint, tangents: MapPoint[], width: number, height: number, clusterCenter?: MapPoint) {
  let angle = Math.PI / 2;
  if (clusterCenter) angle = Math.atan2(point.y - clusterCenter.y, point.x - clusterCenter.x);
  else if (tangents.length) {
    const directions = tangents.map(p => Math.atan2(p.y, p.x)).sort((a, b) => a - b);
    let largest = -1;
    for (let i = 0; i < directions.length; i++) {
      const next = directions[(i + 1) % directions.length] + (i === directions.length - 1 ? Math.PI * 2 : 0);
      if (next - directions[i] > largest) { largest = next - directions[i]; angle = (next + directions[i]) / 2; }
    }
  }
  const dx = Math.cos(angle), dy = Math.sin(angle);
  // Keep the badge rectangle beyond the node along the open sector's bisector.
  const distance = 22 + Math.abs(dx) * width / 2 + Math.abs(dy) * height / 2;
  return { x: point.x + dx * distance - width / 2, y: point.y + dy * distance - height / 2, width, height };
}


export function chainMapTransform(from: ReturnType<typeof fitChainMap>, to: ReturnType<typeof fitChainMap>) {
  if (!from || !to) return "matrix(1, 0, 0, 1, 0, 0)";
  const scale = from.scale / to.scale;
  const longitude = (from.west + from.east - to.west - to.east) / 2;
  const shift = 360 * Math.round(longitude / 360);
  const x = (from.west - shift - to.west) / to.scale;
  const y = to.height / 2 + (to.centerY - from.centerY) / to.scale - from.height / 2 * scale;
  return `matrix(${scale}, 0, 0, ${scale}, ${x}, ${y})`;
}
