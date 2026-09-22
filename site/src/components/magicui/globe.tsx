"use client";
import { useEffect, useRef, useState } from "react";
import createGlobe from "cobe";
import { motion, motionValue } from "motion/react";
import { AnimatedBeam } from "./animated-beam";
import { drawGlobeEffects, projectArcPath } from "./globe-effects";
import { useTheme } from "next-themes";

// Decorative connections illustrate a global research network.
const locations: [number, number][] = [
  [52, 5],
  [40, 116],
  [-23.5, -46.6],
  [1, 104],
  [37, -122],
  [-34, 18],
  [35, 139],
  [21.3, -157.8],
  [-41.3, 174.8],
];
const connections = [
  [0, 1],
  [0, 3],
  [0, 4],
  [0, 5],
  [4, 2],
  [1, 6],
  [2, 5],
  [4, 7],
  [7, 8],
  [8, 6],
];

export function Globe({
  playing,
  visible,
  linkStyle = "solid",
}: {
  playing: boolean;
  visible: boolean;
  linkStyle?: "solid" | "dashed" | "pulse";
}) {
  const [beamPaths] = useState(() => connections.map(() => motionValue("")));
  const canvas = useRef<HTMLCanvasElement>(null);
  const effects = useRef<HTMLCanvasElement>(null);
  const paint = useRef<() => void>(() => {});
  const clock = useRef(0);
  const renderer = useRef<ReturnType<typeof createGlobe> | null>(null);
  const angle = useRef(4.08);
  const drag = useRef<{ x: number; angle: number } | null>(null);
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (!visible || !canvas.current) return;
    const el = canvas.current;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const dark = resolvedTheme === "dark";
    const globe = createGlobe(el, {
      width: el.clientWidth,
      height: el.clientWidth,
      devicePixelRatio: dpr,
      phi: angle.current,
      theta: 0.22,
      scale: 0.96,
      opacity: 1,
      offset: [0, 0],
      mapBaseBrightness: 0,
      dark: dark ? 1 : 0,
      diffuse: 1.4,
      mapSamples: 24000,
      mapBrightness: 5,
      baseColor: dark ? [0.22, 0.3, 0.43] : [0.86, 0.9, 0.96],
      markerColor: [0.16, 0.4, 0.95],
      glowColor: dark ? [0.35, 0.53, 0.8] : [1, 1, 1],
      markers: [],
      markerElevation: 0,
    });
    renderer.current = globe;
    paint.current = () => {
      connections.forEach(([from, to], i) =>
        beamPaths[i].set(
          projectArcPath(locations[from], locations[to], angle.current),
        ),
      );
      if (effects.current)
        drawGlobeEffects(
          effects.current,
          locations,
          angle.current,
          clock.current,
          dark,
        );
    };
    el.dataset.angle = angle.current.toFixed(5);
    el.dataset.markers = String(locations.length);
    el.dataset.arcs = String(connections.length);
    const observer = new ResizeObserver(([entry]) => {
      globe.update({
        width: entry.contentRect.width,
        height: entry.contentRect.width,
      });
      if (effects.current) {
        effects.current.width = Math.round(entry.contentRect.width * dpr);
        effects.current.height = effects.current.width;
        paint.current();
      }
    });
    observer.observe(el);
    let frame = 0,
      last = 0;
    const animate = (t: number) => {
      if (last && !drag.current) angle.current += ((t - last) / 1000) * 0.08;
      if (last) clock.current += t - last;
      last = t;
      paint.current();
      globe.update({ phi: angle.current });
      el.dataset.angle = angle.current.toFixed(5);
      frame = requestAnimationFrame(animate);
    };
    if (playing) frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      globe.destroy();
      renderer.current = null;
    };
  }, [visible, playing, resolvedTheme, beamPaths]);
  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, angle: angle.current };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          angle.current =
            drag.current.angle +
            ((e.clientX - drag.current.x) / e.currentTarget.clientWidth) * 3;
          renderer.current?.update({ phi: angle.current });
          paint.current();
          e.currentTarget.dataset.angle = angle.current.toFixed(5);
        }}
        onPointerUp={(e) => {
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      {beamPaths.map((path, i) => linkStyle === "dashed" ? (
        <svg key={i} aria-hidden="true" viewBox="0 0 1000 1000"
          className="globe-dashed-link" data-playing={playing && visible}>
          <motion.path d={path} fill="none" strokeWidth={4.5}
            strokeLinecap="round" strokeDasharray="14 14" />
        </svg>
      ) : (
        <AnimatedBeam
          key={i}
          projectedPath={path}
          playing={playing && visible}
          glow
          className={linkStyle === "solid" ? "globe-beam globe-beam-green" : "globe-beam"}
          pathColor={resolvedTheme === "dark" ? "#b2d4c1" : "#438b77"}
          pathOpacity={linkStyle === "solid" ? 0.12 : 0}
          pathWidth={linkStyle === "solid" ? 2.8 : 5.5}
          gradientStartColor={linkStyle === "solid" ? "#58ac8b" : "#b93646"}
          gradientStopColor={linkStyle === "solid"
            ? (resolvedTheme === "dark" ? "#e0ffe9" : "#87d6a8")
            : (resolvedTheme === "dark" ? "#ed8990" : "#d64b55")}
          duration={linkStyle === "solid" ? 5 : 2.5}
          delay={i * 0.25}
        />
      ))}
      <canvas ref={effects} className="globe-effects" aria-hidden="true" />
    </>
  );
}
