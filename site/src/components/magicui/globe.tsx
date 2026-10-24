"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useMemo, useId, useState, type PointerEvent, type MouseEvent } from "react";
import createGlobe from "cobe";
import { motion, motionValue } from "motion/react";
import { AnimatedBeam, BeamStroke, BeamGradientStops } from "./animated-beam";
import { drawGlobeEffects, prepareGlobeArc, globeProjection, globePoint, GLOBE_RADIUS, focusOrientation, separateGlobeRoutes } from "./globe-effects";
import { useTheme } from "next-themes";
import { createGlobeMarkers } from "./globe-markers";
import { createGlobeRoutes } from "./globe-routes";
import { createGlobeMapProjection, drawGlobeMap, globeMapLand, globeMapProjection, globeMapTransition, mapNodePose } from "./globe-map";
import { networkLayout, networkCurve, networkProjection, networkSurface, viewMix, type GlobeMode } from "./globe-network";
import { drawNetworkSurface } from "./globe-network-surface";
import { GlobeNetworkGroups, type GeographyPaint } from "./globe-network-groups";
import { RotateCcw } from "lucide-react";
import { createPortal } from "react-dom";
import "./globe-navigation.css";

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

export type GlobeNode = { id: string; label: string; location: [number, number]; countries?: string[] };
export type GlobeLink = { id: string; label: string; from: [number, number]; to: [number, number]; type: string; directed?: boolean; count?: number; groupId?: string };
export type GlobeAnchor = { x: number; y: number; target: string } | null;
export type GlobeHover = { kind: "node" | "link"; id: string } | null;
let lastAngle = 4.08;
const NORMAL_TILT = 0.22;
let lastTilt = NORMAL_TILT;

export function Globe({
  playing,
  visible,
  linkStyle = "solid",
  rotating = true,
  fullscreen = false,
  projection = "globe",
  controls,
  onDragStart,
  nodes, links, layoutLinks, selected, focus, locate, onSelect, onLink, onHover, annotation, onAnnotationMove,
}: {
  playing: boolean;
  visible: boolean;
  rotating?: boolean;
  fullscreen?: boolean;
  projection?: GlobeMode;
  controls?: HTMLElement | null;
  onDragStart?: () => void;
  linkStyle?: "solid" | "dashed" | "pulse";
  nodes?: GlobeNode[];
  links?: GlobeLink[];
  layoutLinks?: GlobeLink[];
  selected?: string;
  focus?: [number, number];
  locate?: { ids: string[]; startedAt: number };
  onSelect?: (id: string) => void;
  onLink?: (id: string) => void;
  onHover?: (item: GlobeHover) => void;
  annotation?: GlobeHover;
  onAnnotationMove?: (point: GlobeAnchor) => void;
}) {
  const routes = useMemo<GlobeLink[]>(() => links ?? connections.map(([from, to], i) => ({ id: String(i), label: "", from: locations[from], to: locations[to], type: "movement" })), [links]);
  const geographic = nodes !== undefined;
  const activeRoute = annotation?.kind === "link" ? annotation.id : undefined;
  const layoutRoutes = layoutLinks ?? routes;
  const routeLayout = useMemo(() => {
    if (!geographic) return new Map<string, [number, number, number]>();
    const bends = separateGlobeRoutes(layoutRoutes.map(route => ({ ...route, id: route.groupId ?? route.id })));
    return new Map(layoutRoutes.map((route, i) => [route.groupId ?? route.id, bends[i]]));
  }, [geographic, layoutRoutes]);
  const routeBends = useMemo(() => routes.map(route => routeLayout.get(route.groupId ?? route.id)), [routes, routeLayout]);
  const curves = useMemo(() => routes.map((route, i) => prepareGlobeArc(route.from, route.to, geographic, routeBends[i])), [routes, geographic, routeBends]);
  const network = useMemo(() => networkLayout(nodes?.map(node => node.location) ?? [], geographic ? routes : []), [geographic, nodes, routes]);
  const geography = useRef<GeographyPaint>(null);
  const [selectedContinents, setSelectedContinents] = useState<string[]>([]);
  const networkCurves = useMemo(() => geographic ? routes.map(route => networkCurve(
    network.positions.get(route.from.join(","))!, network.positions.get(route.to.join(","))!, network.bends.get(route.groupId ?? route.id),
  )) : [], [geographic, routes, network]);
  const nodePoints = useMemo(() => nodes?.map(node => globePoint(node.location).map(v => v * GLOBE_RADIUS) as [number, number, number]), [nodes]);
  const flatNodes = useMemo(() => nodePoints?.map(globeMapProjection(0, 0, 1)), [nodePoints]);
  const networkNodes = useMemo(() => nodes?.map(node => {
    const key = node.location.join(","), isolated = network.isolated.has(key);
    return { ...networkSurface(network.positions.get(key)!), size: isolated ? .62 : 1.08, rim: 0, opacity: isolated ? .5 : 1 };
  }), [nodes, network]);
  const routePaths = useRef<(SVGPathElement | null)[]>([]);
  const routeHalos = useRef<(SVGPathElement | null)[]>([]);
  const routeHits = useRef<(SVGPathElement | null)[]>([]);
  const beamPaths = useMemo(() => routes.map(() => motionValue("")), [routes]);
  const arrows = useMemo(() => routes.map(() => motionValue("")), [routes]);
  const trails = useMemo(() => routes.map(() => motionValue("")), [routes]);
  const trailGradients = useRef<(SVGLinearGradientElement | null)[]>([]);
  const routeCounts = useRef<(SVGGElement | null)[]>([]);
  const routeGroups = useRef<(SVGGElement | null)[]>([]);
  const routeGeometry = useMemo(() => routes.map(() => ({
    line: new Float32Array(768), trail: new Float32Array(768),
    arrow: new Float32Array(8), gradient: new Float32Array(4),
  })), [routes]);
  const pins = useRef<(SVGGElement | null)[]>([]);
  const markers = useRef<(SVGGElement | null)[]>([]);
  const rimArrows = useRef<(SVGGElement | null)[]>([]);
  const haloId = useId();
  const tiltReset = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mapCanvas = useRef<HTMLCanvasElement>(null);
  const networkCanvas = useRef<HTMLCanvasElement>(null);
  const [land, setLand] = useState<[number, number, number][]>([]);
  const mapProjection = useMemo(() => createGlobeMapProjection([...land, ...curves.flatMap(curve => curve.points)]), [land, curves]);
  const mapMix = useRef(0);
  const networkMix = useRef(0);
  const morph = useRef(0);
  useEffect(() => {
    if (!geographic) return;
    let mounted = true;
    void globeMapLand().then(points => { if (mounted) setLand(points); });
    return () => { mounted = false; };
  }, [geographic]);
  const markerCanvas = useRef<HTMLCanvasElement>(null);
  const routeCanvas = useRef<HTMLCanvasElement>(null);
  const markerLayer = useRef<HTMLDivElement>(null);
  const markerRenderer = useRef<ReturnType<typeof createGlobeMarkers>>(null);
  const configureMarkers = useRef<() => void>(() => {});
  const routeRenderer = useRef<ReturnType<typeof createGlobeRoutes>>(null);
  const configureRoutes = useRef<() => void>(() => {});
  const effects = useRef<HTMLCanvasElement>(null);
  const paint = useRef<(drawOverlays?: boolean) => void>(() => {});
  const paintArrows = useRef<() => void>(() => {});
  const drawRoutes = useCallback((time?: number) => {
    const batch = routeRenderer.current;
    if (!batch) return false;
    const transitioning = batch.draw(time);
    if (!batch.available) {
      batch.destroy();
      routeRenderer.current = null;
      paint.current();
      if (markerLayer.current) markerLayer.current.dataset.routeRenderer = "svg";
      return false;
    }
    return transitioning;
  }, []);
  const annotationRef = useRef({ target: annotation, onMove: onAnnotationMove });
  useEffect(() => {
    annotationRef.current = { target: annotation, onMove: onAnnotationMove };
    paint.current();
  }, [annotation, onAnnotationMove]);
  const clock = useRef(0);
  const renderer = useRef<ReturnType<typeof createGlobe> | null>(null);
  const angle = useRef(lastAngle);
  const tilt = useRef(lastTilt);
  const hover = useRef<GlobeHover>(null);
  const flight = useRef(0);
  const overview = useRef<{ phi: number; theta: number } | null>(null);
  const moved = useRef(false);
  const rotatingRef = useRef(rotating);
  useEffect(() => { rotatingRef.current = rotating; }, [rotating]);
  const playingRef = useRef(playing);
  useLayoutEffect(() => { playingRef.current = playing; }, [playing]);
  const drag = useRef<{ x: number; y: number; angle: number; tilt: number; width: number; pointerId: number; target: Element } | null>(null);
  const dragFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(dragFrame.current), []);
  const highlight = useCallback((item: GlobeHover) => {
    if (drag.current || hover.current?.kind === item?.kind && hover.current?.id === item?.id) return;
    hover.current = item; onHover?.(item); paint.current();
  }, [onHover]);
  const renderCamera = useCallback(() => {
    lastAngle = angle.current;
    lastTilt = tilt.current;
    if (canvas.current) {
      canvas.current.dataset.angle = angle.current.toFixed(5);
      canvas.current.dataset.tilt = tilt.current.toFixed(5);
    }
    paint.current();
  }, []);
  const flyTo = useCallback((target: { phi: number; theta: number }, duration = 650) => {
    cancelAnimationFrame(flight.current);
    const from = { phi: angle.current, theta: tilt.current };
    const delta = Math.atan2(Math.sin(target.phi - from.phi), Math.cos(target.phi - from.phi));
    const start = performance.now();
    const move = (time: number) => {
      const p = playingRef.current && visible ? Math.min(1, (time - start) / duration) : 1;
      const ease = p * p * p * (p * (p * 6 - 15) + 10);
      angle.current = from.phi + delta * ease;
      tilt.current = from.theta + (target.theta - from.theta) * ease;
      renderCamera();
      flight.current = p < 1 ? requestAnimationFrame(move) : 0;
    };
    flight.current = requestAnimationFrame(move);
  }, [visible, renderCamera]);
  const releaseDrag = useCallback(() => {
    cancelAnimationFrame(dragFrame.current); dragFrame.current = 0;
    const gesture = drag.current;
    drag.current = null;
    if (gesture?.target.hasPointerCapture(gesture.pointerId)) gesture.target.releasePointerCapture(gesture.pointerId);
    if (canvas.current) delete canvas.current.dataset.dragging;
    if (markerLayer.current) delete markerLayer.current.dataset.dragging;
  }, []);
  useEffect(() => {
    if (fullscreen && visible) return;
    releaseDrag();
    cancelAnimationFrame(flight.current); flight.current = 0;
    if (!fullscreen) {
      tilt.current = NORMAL_TILT;
      if (overview.current) overview.current.theta = NORMAL_TILT;
      renderCamera();
    }
  }, [fullscreen, visible, releaseDrag, renderCamera]);
  useEffect(() => {
    window.addEventListener("blur", releaseDrag);
    return () => { window.removeEventListener("blur", releaseDrag); releaseDrag(); cancelAnimationFrame(flight.current); };
  }, [releaseDrag]);
  const { resolvedTheme } = useTheme();
  useLayoutEffect(() => {
    configureRoutes.current = () => {
      routeRenderer.current?.configure(routeGroups.current.slice(0, routes.length).filter((group): group is SVGGElement => !!group));
    };
    configureRoutes.current();
  }, [routes]);
  useLayoutEffect(() => {
    routeRenderer.current?.styles();
  }, [resolvedTheme, activeRoute]);
  useLayoutEffect(() => {
    configureMarkers.current = () => {
      if (!markerRenderer.current || !markerLayer.current) return;
      markerRenderer.current.configure(nodes?.map(node => node.id) ?? [], playing && visible, selected);
      markerRenderer.current.palette(getComputedStyle(markerLayer.current));
    };
    configureMarkers.current();
  }, [nodes, selected, playing, visible, resolvedTheme]);
  useLayoutEffect(() => {
    const el = markerCanvas.current, routesEl = routeCanvas.current, layer = markerLayer.current;
    if (!visible || !geographic || !el || !routesEl || !layer) return;
    let width = 0, height = 0;
    let resolution = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    const forcedColors = matchMedia('(forced-colors: active)');
    function resize() {
      markerRenderer.current?.resize(width, height);
      routeRenderer.current?.resize(width, height);
      const surfaceWidth = Math.round(width * Math.min(devicePixelRatio, 1.5));
      for (const surface of [mapCanvas.current, networkCanvas.current]) {
        if (surface && surface.width !== surfaceWidth) surface.width = surface.height = surfaceWidth;
      }
      paint.current();
    }
    function resolutionChanged() {
      resolution.removeEventListener("change", resolutionChanged);
      resolution = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
      resolution.addEventListener("change", resolutionChanged);
      resize();
    }
    function start() {
      const batch = createGlobeMarkers(el!);
      markerRenderer.current = batch;
      layer!.dataset.renderer = batch ? "gpu" : "svg";
      const style = getComputedStyle(el!);
      width = parseFloat(style.width); height = parseFloat(style.height);
      if (batch) {
        resize();
        configureMarkers.current();
      }
      paint.current();
    }
    function lost(event: Event) {
      event.preventDefault();
      markerRenderer.current?.destroy();
      markerRenderer.current = null;
      layer!.dataset.renderer = "svg";
      paint.current();
    }
    function startRoutes() {
      const batch = createGlobeRoutes(routesEl!);
      routeRenderer.current = batch;
      if (batch) {
        batch.resize(width, height);
        configureRoutes.current();
      }
      layer!.dataset.routeRenderer = batch ? "gpu" : "svg";
      paint.current();
    }
    function lostRoutes(event: Event) {
      event.preventDefault();
      routeRenderer.current?.destroy();
      routeRenderer.current = null;
      paint.current();
      layer!.dataset.routeRenderer = "svg";
    }
    function refreshStyles() {
      routeRenderer.current?.styles();
      paint.current();
    }
    el.addEventListener("webglcontextlost", lost);
    el.addEventListener("webglcontextrestored", start);
    routesEl.addEventListener("webglcontextlost", lostRoutes);
    routesEl.addEventListener("webglcontextrestored", startRoutes);
    document.fonts.addEventListener("loadingdone", refreshStyles);
    forcedColors.addEventListener("change", refreshStyles);
    resolution.addEventListener("change", resolutionChanged);
    const observer = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height;
      resize();
    });
    observer.observe(el);
    start();
    startRoutes();
    return () => {
      observer.disconnect();
      el.removeEventListener("webglcontextlost", lost);
      el.removeEventListener("webglcontextrestored", start);
      routesEl.removeEventListener("webglcontextlost", lostRoutes);
      routesEl.removeEventListener("webglcontextrestored", startRoutes);
      document.fonts.removeEventListener("loadingdone", refreshStyles);
      forcedColors.removeEventListener("change", refreshStyles);
      resolution.removeEventListener("change", resolutionChanged);
      markerRenderer.current?.destroy();
      markerRenderer.current = null;
      routeRenderer.current?.destroy();
      routeRenderer.current = null;
      layer.dataset.renderer = "svg";
      layer.dataset.routeRenderer = "svg";
      el.width = el.height = 1;
      routesEl.width = routesEl.height = 1;
    };
  }, [visible, geographic]);
  useLayoutEffect(() => {
    if (!visible || !canvas.current) return;
    const el = canvas.current;
    const dpr = Math.min(window.devicePixelRatio, 1.5);
    const dark = resolvedTheme === "dark";
    const globe = createGlobe(el, {
      // The globe shader shades a rectangle; edges live in the overlay.
      context: { antialias: false },
      width: el.clientWidth,
      height: el.clientWidth,
      devicePixelRatio: dpr,
      phi: angle.current,
      theta: tilt.current,
      scale: 0.96,
      opacity: 1,
      offset: [0, 0],
      mapBaseBrightness: 0,
      dark: dark ? 1 : 0,
      diffuse: 1.4,
      mapSamples: 24000,
      mapBrightness: geographic ? (dark ? 1.6 : 0.65) : 5,
      baseColor: dark ? [0.22, 0.3, 0.43] : [0.86, 0.9, 0.96],
      markerColor: [0.16, 0.4, 0.95],
      glowColor: dark ? [0.35, 0.53, 0.8] : [1, 1, 1],
      markers: [],
      markerElevation: 0,
    });
    renderer.current = globe;
    const observer = new ResizeObserver(([entry]) => {
      globe.update({
        width: entry.contentRect.width,
        height: entry.contentRect.width,
      });
      if (effects.current) {
        effects.current.width = Math.round(entry.contentRect.width * dpr);
        effects.current.height = effects.current.width;
      }
      paint.current();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      globe.destroy();
      renderer.current = null;
    };
  }, [visible, resolvedTheme, geographic]);
  useLayoutEffect(() => {
    if (!visible || !canvas.current) return;
    const el = canvas.current;
    const dark = resolvedTheme === "dark";
    let projectedPhi = NaN, projectedTheta = NaN, projectedMap = NaN, projectedNetwork = NaN;
    let projects: ReturnType<typeof globeProjection>[] = [];
    const projections = () => {
      if (angle.current !== projectedPhi || tilt.current !== projectedTheta || mapMix.current !== projectedMap || networkMix.current !== projectedNetwork) {
        const geographicProject = mapProjection(angle.current, tilt.current, mapMix.current);
        projects = curves.map((_, i) => nodes ? networkProjection(geographicProject, networkCurves[i], networkMix.current) : geographicProject);
        projectedPhi = angle.current; projectedTheta = tilt.current; projectedMap = mapMix.current; projectedNetwork = networkMix.current;
      }
      return projects;
    };
    paintArrows.current = () => {
      const projects = projections();
      const batch = routeRenderer.current;
      if (nodes) routes.forEach(({ directed, type }, i) => {
        const project = projects[i];
        if (!directed && type !== "movement") return;
        const length = type === "movement" ? .45 : .22;
        const cycle = (clock.current / (type === "movement" ? 5000 : 5400) + .35 + i * .19) % 1;
        const progress = cycle * (type === "movement" ? 1 + length : 1);
        if (batch) {
          const geometry = routeGeometry[i];
          if (type !== "movement") batch.arrow(i, geometry.arrow, curves[i].arrowSegments(project, geometry.arrow, progress));
          const count = curves[i].trailSegments(project, geometry.trail, geometry.gradient, progress, length);
          const [x1, y1, x2, y2] = geometry.gradient;
          if (type === "movement") batch.trail(i, geometry.trail, count, x2, y2, x1, y1);
          else batch.trail(i, geometry.trail, count, x1, y1, x2, y2);
          return;
        }
        if (type !== "movement") arrows[i].set(curves[i].arrow(project, progress));
        const trail = curves[i].trail(project, progress, length);
        trails[i].set(trail.path);
        const gradient = trailGradients.current[i];
        if (gradient && trail.path) for (const coordinate of ["x1", "y1", "x2", "y2"] as const) gradient.setAttribute(coordinate, String(trail[type === "movement" ? ({ x1: "x2", y1: "y2", x2: "x1", y2: "y1" } as const)[coordinate] : coordinate]));
      });
    };
    let paintedPhi = NaN, paintedTheta = NaN, paintedMix = NaN, paintedNetwork = NaN, paintedMarkers = markerRenderer.current, paintedRoutes = routeRenderer.current;
    let globePhi = NaN, globeTheta = NaN;
    let mapPhi = NaN, mapTheta = NaN, mapProgress = NaN, mapWidth = NaN, networkWidth = NaN;
    let poses: (NonNullable<typeof networkNodes>[number] | null)[] = [];
    paint.current = (drawOverlays = true) => {
      const batch = markerRenderer.current;
      const routeBatch = routeRenderer.current;
      const mix = mapMix.current, net = networkMix.current;
      if (batch) nodes?.forEach((_, i) => {
        const pin = pins.current[i];
        batch.active(i, !!pin?.matches(':hover, :focus-visible, [data-selected="true"]'), !!pin?.matches(":focus-visible"));
      });
      tiltReset.current?.setAttribute("aria-disabled", String(!visible || (projection === "network"
        ? net !== 1 || !selectedContinents.length
        : projection !== "globe" || mix !== 0 || net !== 0 || Math.abs(tilt.current - NORMAL_TILT) <= .02)));
      const transition = globeMapTransition(angle.current, tilt.current, mix);
      const sphere = globeProjection(transition.phi, transition.theta);
      const projects = projections();
      const nodePose = (index: number) => {
        if (net === 1) return networkNodes![index];
        const start = mapNodePose(sphere(nodePoints![index]), flatNodes![index], transition.unfold);
        if (!net) return start ? { ...start, size: 1 } : null;
        const end = networkNodes![index];
        return { x: (start?.x ?? 0) * (1 - net) + end.x * net, y: (start?.y ?? 0) * (1 - net) + end.y * net,
          rotation: (start?.rotation ?? 0) * (1 - net) + end.rotation * net, scale: (start?.scale ?? 1) * (1 - net) + end.scale * net,
          size: 1 + (end.size - 1) * net,
          rim: (start?.rim ?? 0) * (1 - net), opacity: (start?.opacity ?? 0) * (1 - net) + end.opacity * net };
      };
      const globeOpacity = (1 - transition.surface) * (1 - net);
      el.style.opacity = String(globeOpacity);
      if (globeOpacity > 0 && (transition.phi !== globePhi || transition.theta !== globeTheta)) {
        renderer.current?.update({ phi: transition.phi, theta: transition.theta });
        globePhi = transition.phi; globeTheta = transition.theta;
      }
      el.dataset.mapMix = mix === 0 || mix === 1 ? mix.toFixed(4) : String(mix);
      el.dataset.networkMix = net === 0 || net === 1 ? net.toFixed(4) : String(net);
      if (mapCanvas.current) mapCanvas.current.style.opacity = String(1 - net);
      if (mapCanvas.current && net < 1 && (mapWidth !== mapCanvas.current.width || mapPhi !== transition.phi || mapTheta !== transition.theta || mapProgress !== mix)) {
        drawGlobeMap(mapCanvas.current, land, angle.current, tilt.current, mix, dark, mapProjection);
        mapWidth = mapCanvas.current.width; mapPhi = transition.phi; mapTheta = transition.theta; mapProgress = mix;
      }
      if (networkCanvas.current) {
        networkCanvas.current.style.opacity = String(net);
        if (net > 0 && networkWidth !== networkCanvas.current.width) {
          drawNetworkSurface(networkCanvas.current, network.groups, dark);
          networkWidth = networkCanvas.current.width;
        }
      }
      if (angle.current !== paintedPhi || tilt.current !== paintedTheta || mix !== paintedMix || net !== paintedNetwork || batch !== paintedMarkers || routeBatch !== paintedRoutes) {
      poses = nodes?.map((_, i) => nodePose(i)) ?? [];
      geography.current?.paint(poses, net);
      routes.forEach((_, i) => {
        const project = projects[i];
        const path = curves[i].path(project);
        if (nodes) {
          if (routeHits.current[i]?.getAttribute("d") !== path) routeHits.current[i]?.setAttribute("d", path);
          const geometry = routeGeometry[i];
          const count = curves[i].pathSegments(project, geometry.line);
          if (routeBatch) routeBatch.line(i, geometry.line, count);
          else if (routePaths.current[i]?.getAttribute("d") !== path) {
            routePaths.current[i]?.setAttribute("d", path);
            routeHalos.current[i]?.setAttribute("d", path);
          }
        } else beamPaths[i].set(path);
        const badge = routeCounts.current[i];
        if (badge) {
          const anchor = curves[i].anchor(project);
          if (routeBatch) routeBatch.count(i, anchor ? 500 + anchor.x * 480 : 0, anchor ? 500 - anchor.y * 480 : 0, !!anchor);
          else {
            badge.style.visibility = anchor ? "visible" : "hidden";
            if (anchor) badge.setAttribute("transform", `translate(${500 + anchor.x * 480},${500 - anchor.y * 480})`);
          }
        }
      });
      nodes?.forEach((_, i) => {
        const anchor = poses[i];
        const pin = pins.current[i];
        if (pin) {
          if (anchor) pin.setAttribute("transform", `translate(${500 + anchor.x * 480},${500 - anchor.y * 480})`);
          const occluded = anchor?.rim === 1;
          if (pin.dataset.occluded !== String(occluded)) pin.dataset.occluded = String(occluded);
          const visibility = anchor ? "visible" : "hidden";
          if (pin.style.visibility !== visibility) {
            pin.style.visibility = visibility;
            pin.setAttribute("tabindex", anchor ? "0" : "-1");
            pin.setAttribute("aria-hidden", String(!anchor));
          }
          if (!batch && anchor) {
            const marker = markers.current[i], rim = rimArrows.current[i];
            if (marker) {
              marker.setAttribute("transform", `rotate(${anchor.rotation * 180 / Math.PI}) scale(${anchor.scale * anchor.size},${anchor.size})`);
              marker.style.opacity = String((1 - anchor.rim) * anchor.opacity);
            }
            if (rim) {
              rim.setAttribute("transform", `rotate(${anchor.rotation * 180 / Math.PI})`);
              rim.style.display = anchor.rim > 0 ? "block" : "none";
              rim.style.opacity = String(anchor.rim * anchor.opacity);
            }
          }
        }
        batch?.pose(i, anchor ? 500 + anchor.x * 480 : 0, anchor ? 500 - anchor.y * 480 : 0,
          anchor?.rotation ?? 0, anchor?.scale ?? 1, anchor?.rim ?? -1, anchor?.opacity ?? 0, anchor?.size ?? 1);
      });
      paintedPhi = angle.current; paintedTheta = tilt.current; paintedMix = mix; paintedNetwork = net;
      paintedMarkers = batch;
      paintedRoutes = routeBatch;
      }
      if (batch) {
        batch.upload();
        if (drawOverlays) batch.draw();
      }
      paintArrows.current();
      if (drawOverlays) drawRoutes();
      const { target, onMove } = annotationRef.current;
      if (onMove) {
        let anchor = null;
        if (target?.kind === "node") {
          const index = nodes?.findIndex(n => n.id === target.id) ?? -1;
          if (index >= 0) {
            anchor = poses[index];
          }
        } else if (target?.kind === "link") {
          const index = routes.findIndex(r => r.id === target.id);
          const link = routes[index];
          if (link) anchor = curves[index].anchor(projects[index]);
        }
        onMove(anchor ? { x: 500 + anchor.x * 480, y: 500 - anchor.y * 480, target: `${target?.kind}:${target?.id}` } : null);
      }
      if (!nodes && effects.current)
        drawGlobeEffects(
          effects.current,
          locations,
          angle.current,
          clock.current,
          dark, tilt.current,
        );
    };
    paint.current();
    el.dataset.angle = angle.current.toFixed(5);
    el.dataset.tilt = tilt.current.toFixed(5);
    el.dataset.markers = String(nodes?.length ?? locations.length);
    el.dataset.arcs = String(routes.length);
    return () => {
      paint.current = () => {};
      paintArrows.current = () => {};
    };
  }, [visible, resolvedTheme, beamPaths, arrows, trails, routes, nodes, curves, nodePoints, flatNodes, networkNodes, routeGeometry, drawRoutes, land, network, networkCurves, mapProjection, projection, selectedContinents.length]);
  useLayoutEffect(() => {
    const from = { map: mapMix.current, network: networkMix.current }, to = viewMix(from, projection, 1);
    if (from.map === to.map && from.network === to.network) { paint.current(); return; }
    releaseDrag();
    cancelAnimationFrame(flight.current); flight.current = 0;
    const started = performance.now(), duration = 1100 * Math.max(Math.abs(to.map - from.map), Math.abs(to.network - from.network));
    const update = (time: number) => {
      const progress = !playing || !visible || !duration ? 1 : Math.min(1, (time - started) / duration);
      const next = viewMix(from, projection, progress);
      mapMix.current = next.map; networkMix.current = next.network;
      paint.current();
      morph.current = progress < 1 ? requestAnimationFrame(update) : 0;
    };
    if (projection !== "map" || land.length) update(started);
    return () => { cancelAnimationFrame(morph.current); morph.current = 0; };
  }, [projection, playing, visible, land, releaseDrag]);
  useEffect(() => {
    if (!locate || !visible || document.hidden) return;
    const elapsed = performance.now() - locate.startedAt;
    if (elapsed >= 6000) return;
    const frames = playing ? [{ opacity: .25 }, { opacity: 1, offset: .4 }, { opacity: .25 }] : [{ opacity: 1 }, { opacity: 1 }];
    const animations = [...(markerLayer.current?.querySelectorAll('.atlas-locate-beacon') ?? [])].map(element => {
      const animation = element.animate(frames, { id: "atlas-locate-pulse", duration: 1200, iterations: 5, easing: "ease-in-out" });
      animation.currentTime = elapsed;
      return animation;
    });
    return () => animations.forEach(animation => animation.cancel());
  }, [locate, visible, playing]);
  useLayoutEffect(() => { paint.current(); }, [selected, playing, fullscreen, controls]);
  useEffect(() => {
    if (!visible) return;
    const continuous = playing && (!nodes || nodes.length > 0 || rotating || routes.some(route => route.directed || route.type === "movement"));
    let frame = 0, last = 0, rendered = 0;
    const draw = (t: number) => {
      markerRenderer.current?.draw(t);
      const transitioning = drawRoutes(t);
      if (continuous || transitioning) frame = requestAnimationFrame(animate);
    };
    const animate = (t: number) => {
      if (morph.current) { rendered = t; frame = requestAnimationFrame(animate); return; }
      if (!playing) { draw(t); return; }
      if (!nodes) {
        if (last && t - last < 1000 / 30) { draw(t); return; }
        last = t - (t - last) % (1000 / 30);
      }
      const elapsed = rendered ? t - rendered : 0;
      rendered = t;
      if (flight.current) { frame = requestAnimationFrame(animate); return; }
      if (drag.current) { draw(t); return; }
      const turning = projection === "globe" && !hover.current && rotatingRef.current;
      if (turning) angle.current += elapsed / 1000 * 0.08;
      clock.current += elapsed;
      lastAngle = angle.current;
      lastTilt = tilt.current;
      if (turning || !nodes) paint.current(false);
      else paintArrows.current();
      draw(t);
      if (turning && canvas.current) canvas.current.dataset.angle = angle.current.toFixed(5);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, visible, nodes, rotating, routes, activeRoute, drawRoutes, projection]);
  useEffect(() => {
    if (!visible || projection !== "globe" || morph.current || (!focus && !overview.current)) return;
    const from = { phi: angle.current, theta: tilt.current };
    if (focus && !overview.current) overview.current = from;
    const target = focus ? focusOrientation(focus, from.phi) : overview.current!;
    flyTo(target, 650);
    if (!focus) overview.current = null;
    return () => { cancelAnimationFrame(flight.current); flight.current = 0; };
  }, [focus, visible, flyTo, projection]);
  function paintDrag() {
    dragFrame.current = 0;
    renderCamera();
  }
  function finishDrag(event: PointerEvent<HTMLCanvasElement | HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const pending = dragFrame.current;
    releaseDrag();
    if (pending) paintDrag();
  }
  function handleClickCapture(event: MouseEvent<HTMLCanvasElement | HTMLDivElement>) {
    if (event.detail && moved.current) { event.preventDefault(); event.stopPropagation(); }
  }
  function handlePointerDown(event: PointerEvent<HTMLCanvasElement | HTMLDivElement>) {
    moved.current = false;
    if (projection !== "globe" || morph.current) return;
    if (!event.isPrimary || event.button !== 0 || drag.current || !canvas.current || !(event.target instanceof Element)) return;
    cancelAnimationFrame(flight.current); flight.current = 0;
    highlight(null);
    moved.current = false;
    drag.current = { x: event.clientX, y: event.clientY, angle: angle.current, tilt: tilt.current,
      width: canvas.current.getBoundingClientRect().width, pointerId: event.pointerId, target: event.target };
    event.target.setPointerCapture(event.pointerId);
  }
  function handlePointerMove(event: PointerEvent<HTMLCanvasElement | HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId || !canvas.current) return;
    if (!moved.current && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 5) {
      moved.current = true;
      onDragStart?.();
    }
    if (!moved.current) return;
    event.currentTarget.dataset.dragging = "true";
    angle.current = gesture.angle + (event.clientX - gesture.x) / gesture.width * 3;
    if (fullscreen) tilt.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, gesture.tilt + (event.clientY - gesture.y) / gesture.width * 3));
    if (!dragFrame.current) dragFrame.current = requestAnimationFrame(paintDrag);
  }
  // Pointer previews wait for camera centering; clicks and keyboard focus remain available.
  const routeTargets = useMemo(() => routes.map((route, i) => <path key={route.groupId ?? route.id} ref={el => { routeHits.current[i] = el; }} fill="none" stroke="transparent" strokeWidth={18} className="atlas-link-target"
          role="button" tabIndex={0} aria-label={route.label} aria-description={route.count && route.count > 1 ? `${route.count} links between these locations` : undefined} onPointerMove={() => { if (!flight.current) highlight({ kind: "link", id: route.id }); }} onPointerLeave={() => highlight(null)} onFocus={() => highlight({ kind: "link", id: route.id })} onBlur={() => highlight(null)} onClick={() => { highlight(null); onLink?.(route.id); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); highlight(null); onLink?.(route.id); } }}></path>), [routes, highlight, onLink]);
  const nodeElements = useMemo(() => nodes?.map((node, i) => ({ node, i })).sort((a, b) => Number(a.node.id === selected) - Number(b.node.id === selected)).map(({ node, i }) => <g key={node.id} ref={el => { pins.current[i] = el; }} className="atlas-globe-pin"
          data-selected={selected === node.id} data-network-isolated={network.isolated.has(node.location.join(","))} role="button" tabIndex={0} aria-label={node.label} onPointerMove={() => { if (!flight.current) highlight({ kind: "node", id: node.id }); }} onPointerLeave={() => highlight(null)} onFocus={() => highlight({ kind: "node", id: node.id })} onBlur={() => highlight(null)} onClick={() => { highlight(null); onSelect?.(node.id); }}
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); highlight(null); onSelect?.(node.id); } }}>
          <g ref={el => { markers.current[i] = el; }} className="atlas-event-marker" aria-hidden="true">
            <circle className="atlas-event-halo" r="18" fill={`url(#${haloId})`} />
            <circle className="atlas-event-pulse" r="10" style={{ animationDelay: `${-i * .37}s` }} />
            <circle className="atlas-event-ring" r="7" />
            <circle className="atlas-event-core" r="3.5" />
            <circle className="atlas-event-spark" r="1.3" />
          </g>
          <g ref={el => { rimArrows.current[i] = el; }} className="atlas-rim-arrow" aria-hidden="true">
            <path className="atlas-rim-glow" d="M-3 -5L2 0L-3 5" />
            <path className="atlas-rim-chevron" d="M-3 -5L2 0L-3 5" />
          </g>
          {locate?.ids.includes(node.id) && <g className="atlas-locate-beacon" aria-hidden="true">
            <circle r="30" fill={`url(#${haloId}-locate)`} />
            <circle r="13" fill="none" stroke="var(--atlas-locate)" strokeWidth="2.5" />
            <circle r="5" fill="var(--atlas-locate)" />
            <circle r="1.5" fill="var(--background)" />
          </g>}
          <circle className="atlas-globe-hit" r="11" />
        </g>), [nodes, selected, network, highlight, onSelect, haloId, locate]);
  const routeElements = useMemo(() => routes.map((route, i) => <g key={`visual:${route.groupId ?? route.id}`} ref={el => { routeGroups.current[i] = el; }} className="atlas-route" data-kind={route.type} data-active={activeRoute === route.id} aria-hidden="true">
          <path ref={el => { routeHalos.current[i] = el; }} className="atlas-route-halo" />
          <path ref={el => { routePaths.current[i] = el; }} className="atlas-route-line" />
          {route.type === "movement" ? <g className="atlas-travel-beam globe-beam-green">
            <defs><linearGradient id={`${haloId}-trail-${i}`} ref={el => { trailGradients.current[i] = el; }} gradientUnits="userSpaceOnUse">
              <BeamGradientStops start="#58ac8b" end="var(--atlas-travel-head)" projected />
            </linearGradient></defs>
            <BeamStroke path={trails[i]} gradientId={`${haloId}-trail-${i}`} width={2} glow />
          </g> : route.directed && <><defs><linearGradient id={`${haloId}-trail-${i}`} ref={el => { trailGradients.current[i] = el; }} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--atlas-beam)" stopOpacity="0" />
            <stop offset=".2" stopColor="var(--atlas-beam)" stopOpacity=".06" />
            <stop offset=".5" stopColor="var(--atlas-beam)" stopOpacity=".3" />
            <stop offset=".8" stopColor="var(--atlas-beam)" stopOpacity=".7" />
            <stop offset="1" stopColor="var(--atlas-beam)" stopOpacity="1" />
          </linearGradient></defs><motion.path d={trails[i]} className="atlas-route-trail-halo" style={{ stroke: `url(#${haloId}-trail-${i})` }} /><motion.path d={trails[i]} className="atlas-route-beam" style={{ stroke: `url(#${haloId}-trail-${i})` }} /><motion.path d={arrows[i]} className="atlas-route-arrow-halo" /><motion.path d={arrows[i]} className="atlas-route-arrow" /></>}
          {route.count && route.count > 1 && <g ref={el => { routeCounts.current[i] = el; }} className="atlas-route-count"><circle r="13" /><text textAnchor="middle" dy=".35em">{route.count}</text></g>}
        </g>), [routes, activeRoute, haloId, trails, arrows]);
  return (
    <>
      <div className="globe-camera-viewport"><div className="globe-camera-scene" data-projection={projection}>
      <canvas ref={canvas} aria-hidden="true" onClickCapture={handleClickCapture} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onLostPointerCapture={finishDrag} onPointerCancel={finishDrag} />
      {geographic && <><canvas ref={mapCanvas} className="globe-map-surface" aria-hidden="true" /><canvas ref={networkCanvas} className="globe-network-surface" aria-hidden="true" /></>}
      {nodes && <GlobeNetworkGroups ref={geography} nodes={nodes} componentOf={network.componentOf} isolated={network.isolated} enabled={fullscreen && projection === "network"}
        regions={selectedContinents} onRegionsChange={setSelectedContinents}
        activeCountries={annotation?.kind === "node" ? nodes.find(node => node.id === annotation.id)?.countries ?? [] : []} />}
      {!nodes && beamPaths.map((path, i) => linkStyle === "dashed" ? (
        <svg key={i} aria-hidden="true" viewBox="0 0 1000 1000"
          className="globe-dashed-link" data-playing={playing && visible}>
          <motion.path d={path} fill="none" strokeWidth={4.5}
            strokeLinecap="round" strokeDasharray="14 14" />
        </svg>
      ) : (
        <AnimatedBeam
          key={i}
          projectedPath={path}
          playing={playing && visible && routes[i].type === "movement"}
          glow
          className={linkStyle === "solid" ? "globe-beam globe-beam-green" : "globe-beam"}
          pathColor={routes[i].type === "hypothesis" ? "#ce8876" : routes[i].type === "shared_event" ? "#72a995" : "var(--globe-link-base)"}
          pathOpacity={linkStyle === "solid" ? 0.12 : 0}
          pathWidth={linkStyle === "solid" ? 2.8 : 5.5}
          gradientStartColor={linkStyle === "solid" ? "#58ac8b" : "#b93646"}
          gradientStopColor="var(--globe-beam-tip)"
          duration={linkStyle === "solid" ? 5 : 2.5}
          delay={i * 0.25}
        />
      ))}
      {nodes && <div ref={markerLayer} className="atlas-globe-pins" role="group" onClickCapture={handleClickCapture} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishDrag} onLostPointerCapture={finishDrag} onPointerCancel={finishDrag} data-playing={playing && visible} aria-label="Reporting locations and geographic links">
        <svg viewBox="0 0 1000 1000">
        {routeTargets}
        </svg>
        <canvas ref={markerCanvas} className="atlas-marker-canvas" aria-hidden="true" />
        <svg viewBox="0 0 1000 1000">
        <defs><radialGradient id={haloId}><stop offset="0" stopColor="var(--atlas-marker-halo)" stopOpacity=".45" /><stop offset="1" stopColor="var(--atlas-marker-halo)" stopOpacity="0" /></radialGradient><radialGradient id={`${haloId}-locate`}><stop offset="0" stopColor="var(--atlas-locate)" stopOpacity=".8" /><stop offset="1" stopColor="var(--atlas-locate)" stopOpacity="0" /></radialGradient></defs>
        {nodeElements}
        {routeElements}
        </svg>
        <canvas ref={routeCanvas} className="atlas-route-canvas" aria-hidden="true" />
      </div>}
      {!nodes && <canvas ref={effects} className="globe-effects" aria-hidden="true" />}
      </div></div>
      {fullscreen && geographic && controls && createPortal(<button ref={tiltReset} className="atlas-tilt-reset" aria-label={projection === "network" ? "Clear continent selection" : "Reset globe tilt"} title={projection === "network" ? "Clear continent selection" : "Reset globe tilt"} aria-disabled="true" onClick={() => {
        if (!visible || morph.current) return;
        if (projection === "network") { setSelectedContinents([]); return; }
        if (projection !== "globe" || Math.abs(tilt.current - NORMAL_TILT) <= .02) return;
        if (overview.current) overview.current.theta = NORMAL_TILT;
        flyTo({ phi: angle.current, theta: NORMAL_TILT });
      }}><RotateCcw size={15} aria-hidden /></button>, controls)}
    </>
  );
}
