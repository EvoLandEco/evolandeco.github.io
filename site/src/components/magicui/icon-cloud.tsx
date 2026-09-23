"use client";
import { useEffect, useRef, useState } from "react";
export function IconCloud({
  images,
  playing,
  visible,
}: {
  images: string[];
  playing: boolean;
  visible: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    rotation = useRef({ x: 0.2, y: 0 }),
    [error, setError] = useState("");
  useEffect(() => {
    if (!visible || !canvas.current) return;
    const el = canvas.current,
      ctx = el.getContext("2d");
    if (!ctx) return;
    let cancelled = false,
      frame = 0,
      last = 0,
      width = el.clientWidth;
    const dpr = devicePixelRatio;
    const positions = images.map((_, i) => {
      const y = (i * 2) / images.length - 1 + 1 / images.length,
        r = Math.sqrt(1 - y * y),
        phi = i * Math.PI * (3 - Math.sqrt(5));
      return { x: Math.cos(phi) * r, y, z: Math.sin(phi) * r };
    });
    let sources: HTMLImageElement[] = [];
    let assets: HTMLCanvasElement[] = [];
    const rasterize = () => {
      assets = sources.map(image => {
        const sprite = document.createElement("canvas");
        sprite.width = sprite.height = Math.ceil(width * 0.14 * dpr);
        sprite.getContext("2d")?.drawImage(image, 0, 0, sprite.width, sprite.height);
        return sprite;
      });
    };
    const draw = (t: number) => {
      if (cancelled) return;
      if (playing && last) rotation.current.y += ((t - last) / 1000) * 0.16;
      last = t;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, width);
      const { x: rx, y: ry } = rotation.current;
      const projected = positions
        .map((p, i) => {
          const x = p.x * Math.cos(ry) - p.z * Math.sin(ry),
            z = p.x * Math.sin(ry) + p.z * Math.cos(ry);
          return {
            i,
            x,
            y: p.y * Math.cos(rx) - z * Math.sin(rx),
            z: p.y * Math.sin(rx) + z * Math.cos(rx),
          };
        })
        .sort((a, b) => a.z - b.z);
      for (const p of projected) {
        const scale = (p.z + 2) / 3,
          size = width * 0.14 * scale;
        ctx.globalAlpha = 0.45 + (0.55 * (p.z + 1)) / 2;
        ctx.drawImage(
          assets[p.i],
          width / 2 + p.x * width * 0.33 - size / 2,
          width / 2 + p.y * width * 0.33 - size / 2,
          size,
          size,
        );
      }
      ctx.globalAlpha = 1;
      el.dataset.angle = rotation.current.y.toFixed(5);
      el.dataset.ready = "true";
      if (playing) frame = requestAnimationFrame(draw);
    };
    const resize = () => {
      width = el.clientWidth;
      el.width = Math.round(width * dpr);
      el.height = Math.round(width * dpr);
      if (sources.length) {
        rasterize();
        cancelAnimationFrame(frame);
        last = 0;
        draw(performance.now());
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    resize();
    const loaded = images.map(
      (src) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = () =>
            reject(new Error(`Toolkit image could not load: ${src}`));
          image.src = src;
        }),
    );
    Promise.all(loaded)
      .then((result) => {
        if (cancelled) return;
        sources = result;
        rasterize();
        draw(performance.now());
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [images, playing, visible]);
  return (
    <div className="cloud">
      <canvas ref={canvas} width={320} height={320} aria-hidden="true" />
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
