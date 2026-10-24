import { networkSurface, type NetworkPoint } from "./globe-network";

type Component = NetworkPoint & { r: number; count: number };

export function drawNetworkSurface(canvas: HTMLCanvasElement, groups: Component[], dark: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width;
  ctx.clearRect(0, 0, width, width);
  const pixel = (point: NetworkPoint) => {
    const p = networkSurface(point);
    return { x: width * (.5 + p.x * .48), y: width * (.5 - p.y * .48) };
  };
  const path = (point: (t: number) => NetworkPoint, closed = false) => {
    ctx.beginPath();
    for (let i = 0; i <= 96; i++) {
      const p = pixel(point(i / 96));
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    if (closed) ctx.closePath();
  };
  const circle = (x: number, y: number, radius: number) => path(t => ({ x: x + radius * Math.cos(t * Math.PI * 2), y: y + radius * Math.sin(t * Math.PI * 2) }), true);
  circle(0, 0, 1);
  const shade = ctx.createRadialGradient(width * .43, width * .35, 0, width * .5, width * .48, width * .5);
  shade.addColorStop(0, dark ? "rgba(64,97,130,.17)" : "rgba(204,224,237,.27)");
  shade.addColorStop(.7, dark ? "rgba(48,86,105,.07)" : "rgba(212,233,232,.14)");
  shade.addColorStop(1, "rgba(94,142,167,0)");
  ctx.fillStyle = shade; ctx.fill();
  ctx.strokeStyle = dark ? "rgba(132,169,193,.15)" : "rgba(82,127,155,.15)";
  ctx.lineWidth = width / 1400; ctx.stroke();
  ctx.save(); ctx.clip();
  for (const group of groups) if (group.count > 2) {
    circle(group.x, group.y, group.r);
    ctx.fillStyle = dark ? "rgba(101,163,155,.025)" : "rgba(93,157,151,.025)";
    ctx.fill();
  }
  ctx.strokeStyle = dark ? "rgba(132,169,193,.065)" : "rgba(82,127,155,.065)";
  ctx.lineWidth = width / 1800;
  for (const coordinate of [-.75, -.5, -.25, 0, .25, .5, .75]) {
    const extent = Math.sqrt(1 - coordinate * coordinate);
    path(t => ({ x: coordinate, y: (2 * t - 1) * extent })); ctx.stroke();
    path(t => ({ x: (2 * t - 1) * extent, y: coordinate })); ctx.stroke();
  }
  ctx.restore();
}
