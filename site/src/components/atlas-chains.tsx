import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EvidenceSummary } from "./atlas-evidence-summary";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, CalendarDays, ChevronDown, FileText, GitBranch, MapPin, MapPinOff, X } from "lucide-react";
import { useAtlas } from "./atlas-context";
import { useElementSize } from "./use-element-size";
import { AtlasSelect } from "./atlas-select";
import { LocationBadges } from "./atlas-location-badges";
import { fitChainMap, chainLandDots, chainEdgeGeometry, chainBadgePosition, chainMapTransform } from "@/lib/atlas-chain-map";
import { revealAtlasEntries } from "@/lib/atlas-detail-scroll";
import { formatDate } from "@/lib/atlas";
import type { AtlasSelectedChain, AtlasChainKind } from "@/lib/atlas-contract";

const kinds: Record<AtlasChainKind, string> = {
  established_transmission: "Source-established transmission", contact_exposure: "Reported contacts & exposure",
  travel_itinerary: "Reported journey", reporting_sequence: "Selected report sequence",
};

export function AtlasChains({ chains, onReport }: { chains: AtlasSelectedChain[]; onReport: (ids: string[]) => void }) {
  const [choice, setChoice] = useState("");
  const chain = chains.find(c => c.id === choice) ?? chains[0];
  if (!chain) return null;
  return <section id="atlas-journeys" className="atlas-chain-section" aria-labelledby="atlas-chains-title">
    <header><GitBranch size={18} aria-hidden /><h2 id="atlas-chains-title">Journeys & connections</h2><span>{chains.length}</span></header>
    <AtlasSelect label="Reviewed chain" value={chain.id} onChange={setChoice} items={chains.map(c => ({ value: c.id, label: c.label, badges: [
      { kind: "kind", label: kinds[c.kind] },
      { kind: "count", label: `${c.nodes.length} ${c.nodes.length === 1 ? "event" : "events"}` },
      ...(c.nodes.some(n => !n.place_id) ? [{ kind: "place" as const, label: `${c.nodes.filter(n => !n.place_id).length} unlocated` }] : []),
    ] }))} />
    <ChainFigure chain={chain} onReport={onReport} />
  </section>;
}

function ChainFigure({ chain, onReport }: { chain: AtlasSelectedChain; onReport: (ids: string[]) => void }) {
  const { bundle, evidence, atlasDocuments } = useAtlas();
  const arrow = useId();
  const reducedMotion = useReducedMotion();
  const transition = { duration: reducedMotion ? 0 : .55, ease: "easeInOut" as const };
  const { ref: map, size } = useElementSize<SVGSVGElement>();
  const details = useRef<HTMLDivElement>(null);
  const selection = useRef<HTMLDivElement>(null);
  const nodesGroup = useRef<HTMLDetailsElement>(null);
  const routesGroup = useRef<HTMLDetailsElement>(null);
  const [selected, setSelected] = useState("");
  const [hovered, setHovered] = useState("");
  const [focused, setFocused] = useState("");
  const hoverFigure = (id: string, focus = false) => {
    if (focus) { setFocused(id); setHovered(""); } else setHovered(id);
    const group = chain.nodes.some(node => node.id === id) ? nodesGroup.current : routesGroup.current;
    if (group) group.open = true;
    revealAtlasEntries(details.current, [id], group?.querySelector("summary")?.getBoundingClientRect().height ?? 0);
  };
  const hoverProps = (id: string, figure = false) => ({
    "data-highlighted": hovered === id || focused === id || undefined,
    onPointerMove: () => figure ? hoverFigure(id) : setHovered(id), onPointerLeave: () => setHovered(current => current === id ? "" : current),
    onFocus: () => { if (figure) hoverFigure(id, true); else { setFocused(id); setHovered(""); } }, onBlur: () => setFocused(current => current === id ? "" : current),
  });
  const [selectionChain, setSelectionChain] = useState(chain.id);
  if (selectionChain !== chain.id) { setSelectionChain(chain.id); setSelected(""); setHovered(""); setFocused(""); }
  useEffect(() => {
    if (details.current && selection.current) {
      details.current.scrollTop += selection.current.closest(".atlas-chain-entry")!.getBoundingClientRect().top - details.current.getBoundingClientRect().top - 42;
    }
  }, [selected]);
  useEffect(() => { details.current?.scrollTo({ top: 0 }); }, [chain.id]);
  const geography = useMemo(() => {
    if (!size) return null;
    const groups = new Map<string, { longitude: number; latitude: number; ids: string[]; numbers: number[] }>();
    chain.nodes.forEach((node, index) => {
      if (!node.place_id) return;
      const place = bundle.places.find(p => p.id === node.place_id)!;
      const key = `${place.longitude},${place.latitude}`;
      const group = groups.get(key) ?? { longitude: place.longitude, latitude: place.latitude, ids: [], numbers: [] };
      group.ids.push(node.id); group.numbers.push(index + 1); groups.set(key, group);
    });
    const locations = [...groups.values()].map(p => ({ ...p, radius: p.ids.length > 1 ? Math.max(48, 36 / Math.sin(Math.PI / p.ids.length)) : 0 }));
    const largest = Math.max(0, ...locations.map(p => p.radius));
    const unlocated = chain.nodes.filter(node => !node.place_id);
    const badgeWidth = Math.max(0, ...chain.nodes.map(node => (node.place_id ? bundle.places.find(p => p.id === node.place_id)!.area_codes.length : 0) * 54));
    const padding = { x: largest + Math.max(90, 22 + badgeWidth), y: largest + 85 };
    const unlocatedWidth = unlocated.length ? 200 : 0;
    const scale = Math.max(1, (padding.x * 2 + 30 + unlocatedWidth) / size.width, Math.max(padding.y * 2 + 30, unlocated.length * 80 + 60) / size.height);
    let mapWidth = size.width * scale - unlocatedWidth, height = size.height * scale;
    let frame = fitChainMap(locations, mapWidth, height, padding);
    const centers = locations.map(p => ({ ...p, ...frame!.project(p) }));
    const separation = Math.max(1, ...centers.flatMap((a, i) => centers.slice(i + 1).map(b =>
      (a.radius + b.radius + (a.radius || b.radius ? 164 : 32)) / Math.hypot(a.x - b.x, a.y - b.y))));
    if (separation > 1) {
      mapWidth = size.width * scale * separation - unlocatedWidth;
      height = size.height * scale * separation;
      frame = fitChainMap(locations, mapWidth, height, padding);
    }
    const clusters = locations.map(p => ({ ...p, ...frame!.project(p) }));
    const members = clusters.flatMap(p => p.ids.map((id, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / p.ids.length;
      return { id, number: p.numbers[index], cluster: p.ids.length > 1 ? p.ids.join() : undefined,
        x: p.x + p.radius * Math.cos(angle), y: p.y + p.radius * Math.sin(angle), unlocated: false };
    }));
    return { frame, height, width: mapWidth + (unlocated.length ? 200 : 0), mapWidth, clusters: clusters.filter(p => p.ids.length > 1),
      pins: [...members, ...unlocated.map((node, index) => ({ id: node.id, number: chain.nodes.indexOf(node) + 1,
        x: mapWidth + 115, y: 60 + (index + .5) * (height - 60) / unlocated.length, cluster: undefined, unlocated: true }))],
      unlocated: unlocated.length > 0, dots: frame ? chainLandDots(frame) : "" };
  }, [chain, bundle.places, size]);
  const nodeCountries = chain.nodes.map(node => node.place_id ? bundle.places.find(p => p.id === node.place_id)!.area_codes : []);
  const pins = geography?.pins ?? [];
  const supportedEdges = new Set(chain.drawable_edge_ids);
  const routes = chain.edges.flatMap(edge => {
    if (!geography) return [];
    const a = pins.find(p => p.id === edge.from_node_id)!, b = pins.find(p => p.id === edge.to_node_id)!;
    const schematic = a.unlocated || b.unlocated;
    if (!schematic && !supportedEdges.has(edge.id)) return [];
    const curve = chainEdgeGeometry(a, b);
    return curve ? [{ edge, schematic, ...curve }] : [];
  });
  const badges = pins.map(p => chainBadgePosition(p, routes.flatMap(route => {
    const endpoint = route.edge.from_node_id === p.id ? route.start : route.edge.to_node_id === p.id ? route.end : null;
    return endpoint ? [{ x: route.control.x - endpoint.x, y: route.control.y - endpoint.y }] : [];
  }), nodeCountries[p.number - 1].length * 54, 24, geography?.clusters.find(c => c.ids.includes(p.id))));
  const activate = (id: string) => {
    const group = chain.nodes.some(node => node.id === id) ? nodesGroup.current : routesGroup.current;
    if (group) group.open = true;
    setSelected(current => current === id ? "" : id);
  };
  const renderEvidence = (item: AtlasSelectedChain["nodes"][number] | AtlasSelectedChain["edges"][number]) => selected === item.id && <div ref={selection} className="atlas-chain-evidence" role="region" aria-label="Selected chain evidence">
    <p>{"membership_basis" in item ? item.membership_basis : item.basis}</p>
    {"place_id" in item && <p className="atlas-chart-note">{[item.coordinate_precision, item.location_note, item.date_note].filter(Boolean).join(" · ")}</p>}
    {item.uncertainty && <p className="atlas-chart-note">{item.uncertainty}</p>}
    <button onClick={() => onReport(item.record_ids)}><FileText size={14} aria-hidden />View reports</button>
    <details><EvidenceSummary kind="source" />{item.evidence_ids.map(id => {
      const entry = evidence.get(id)!, report = atlasDocuments.get(entry.document_id)!;
      return <blockquote key={id}><p>{entry.quote}</p><a href={report.url} target="_blank" rel="noopener noreferrer">{report.title} · {formatDate(report.publication)}</a></blockquote>;
    })}</details>
  </div>;
  return <figure className="atlas-chain-figure" data-kind={chain.kind} aria-label={chain.label}>
    {!chain.selection_complete && <figcaption><span className="atlas-status">Partial selection</span></figcaption>}
    <div className="atlas-chain-map-panel">
    <motion.svg ref={map} className="atlas-chain-map" initial={false} animate={{ viewBox: geography ? `0 0 ${geography.width} ${geography.height}` : undefined }} transition={transition} role="group" aria-label={`Map of ${chain.label}`}>
      {geography && <>
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M2 2L8 5L2 8" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
      <ChainLand frame={geography.frame} dots={geography.dots} reducedMotion={Boolean(reducedMotion)} />
      {geography.unlocated && <g className="atlas-chain-unlocated-zone">
        <rect x={geography.mapWidth + 40} y="10" width="150" height={geography.height - 20} rx="16" />
        <text x={geography.mapWidth + 115} y="38" textAnchor="middle">Unlocated</text>
      </g>}
      {geography.clusters.map(p => <motion.g key={p.ids.join()} initial={reducedMotion ? false : { opacity: 0, x: p.x, y: p.y }} animate={{ opacity: 1, x: p.x, y: p.y }} transition={transition} className="atlas-chain-cluster" role="group" aria-label={`${p.ids.length} events at one reference location`}>
        <motion.ellipse initial={false} animate={{ rx: p.radius + 82, ry: p.radius + 50 }} transition={transition} />
        <text y={p.radius + 64} textAnchor="middle">Shared location · {p.ids.length} events</text>
      </motion.g>)}
      {routes.map(({ edge, schematic, path }) => {
        return <g key={edge.id} className="atlas-chain-edge" {...hoverProps(edge.id, true)} data-schematic={schematic || undefined} role="button" tabIndex={0} aria-label={edge.label} aria-pressed={selected === edge.id} onClick={() => activate(edge.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(edge.id); } }}>
          <title>{edge.label}</title><motion.path className="atlas-chain-edge-hit" initial={false} animate={{ d: path }} transition={transition} /><motion.path className="atlas-chain-edge-line" initial={reducedMotion ? false : { d: path, pathLength: 0, opacity: 0 }} animate={{ d: path, pathLength: 1, opacity: 1 }} transition={transition} markerEnd={edge.directed ? `url(#${arrow})` : undefined} />
        </g>;
      })}
      {pins.map((p, index) => <motion.g key={p.id} initial={reducedMotion ? false : { x: p.x, y: p.y, opacity: 0, scale: .8 }} animate={{ x: p.x, y: p.y, opacity: 1, scale: 1 }} transition={transition} className="atlas-chain-pin" {...hoverProps(p.id, true)} data-cluster={p.cluster} data-unlocated={p.unlocated || undefined} role="button" tabIndex={0} aria-label={chain.nodes[p.number - 1].label} aria-pressed={selected === p.id} onClick={() => activate(p.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(p.id); } }}>
        <title>{chain.nodes[p.number - 1].label}</title>
        <circle className="atlas-chain-pin-halo" r={23} /><circle r={15} />
        <text dy=".35em" textAnchor="middle">{p.number}</text>
        {nodeCountries[p.number - 1].length > 0 && <motion.foreignObject initial={false} animate={{ ...badges[index], x: badges[index].x - p.x, y: badges[index].y - p.y }} transition={transition}><div className="atlas-chain-pin-location"><LocationBadges codes={nodeCountries[p.number - 1]} /></div></motion.foreignObject>}
      </motion.g>)}
      </>}
    </motion.svg>
    <ChainReview chain={chain} />
    </div>
    <motion.div key={chain.id} ref={details} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={transition} className="atlas-chain-details" role="region" aria-label="Journey details" tabIndex={0}>
    <details ref={nodesGroup} className="atlas-chain-group" open onToggle={event => { if (event.target === event.currentTarget && !event.currentTarget.open && chain.nodes.some(node => node.id === selected)) setSelected(""); }}>
      <summary><MapPin size={14} aria-hidden /><span>Nodes</span><small>{chain.nodes.length}</small><ChevronDown size={14} aria-hidden /></summary>
      <ol className="atlas-chain-nodes">{chain.nodes.map((node, index) => <li key={node.id}>
        <details className="atlas-chain-entry" {...hoverProps(node.id)} open={selected === node.id}>
          <summary data-entry-id={node.id} onClick={event => { event.preventDefault(); activate(node.id); }}>
            <span className="atlas-chain-number">{index + 1}</span><span className="atlas-chain-node-copy"><span className="atlas-chain-node-title">{node.label}{nodeCountries[index].length > 0 && <LocationBadges codes={nodeCountries[index]} />}</span><small>{node.event_date.value ? `${node.date_basis} · ${formatDate(node.event_date.value)}` : ""}{!node.place_id && <><MapPinOff size={11} aria-hidden />Unlocated</>}</small></span>
            <span className="atlas-chain-toggle" aria-hidden>{selected === node.id ? <X size={14} /> : <ChevronDown size={14} />}</span>
          </summary>
          {renderEvidence(node)}
        </details>
      </li>)}</ol>
    </details>
    <details ref={routesGroup} className="atlas-chain-group" open onToggle={event => { if (event.target === event.currentTarget && !event.currentTarget.open && chain.edges.some(edge => edge.id === selected)) setSelected(""); }}>
      <summary><GitBranch size={14} aria-hidden /><span>Routes</span><small>{chain.edges.length}</small><ChevronDown size={14} aria-hidden /></summary>
      <ol className="atlas-chain-connections" aria-label="Chain connections">{chain.edges.map(edge => <li key={edge.id}>
        <details className="atlas-chain-entry" {...hoverProps(edge.id)} open={selected === edge.id}>
          <summary data-entry-id={edge.id} onClick={event => { event.preventDefault(); activate(edge.id); }}>
            <span className="atlas-chain-route"><span>{chain.nodes.findIndex(n => n.id === edge.from_node_id) + 1}</span>{edge.directed ? <ArrowRight size={14} aria-hidden /> : <span>—</span>}<span>{chain.nodes.findIndex(n => n.id === edge.to_node_id) + 1}</span></span><span className="atlas-chain-node-copy">{edge.label}</span>
            <span className="atlas-chain-toggle" aria-hidden>{selected === edge.id ? <X size={14} /> : <ChevronDown size={14} />}</span>
          </summary>
          {renderEvidence(edge)}
        </details>
      </li>)}</ol>
    </details>
    </motion.div>
  </figure>;
}


type MapFrame = ReturnType<typeof fitChainMap>;

function ChainLand({ frame, dots, reducedMotion }: { frame: MapFrame; dots: string; reducedMotion: boolean }) {
  const [frames, setFrames] = useState({ current: frame, previous: frame });
  if (frames.current !== frame) setFrames({ current: frame, previous: frames.current });
  const key = frame ? [frame.west, frame.east, frame.centerY, frame.scale, frame.height].join(":") : "unlocated";
  return <AnimatePresence initial={false} custom={frame}>
    <motion.g key={key} aria-hidden style={{ pointerEvents: "none", transformOrigin: "0px 0px" }}
      initial={reducedMotion ? false : { opacity: 0, transform: chainMapTransform(frame, frames.previous) }}
      animate={{ opacity: 1, transform: "matrix(1, 0, 0, 1, 0, 0)" }}
      exit="depart" variants={{ depart: (target: MapFrame) => ({ opacity: 0, transform: chainMapTransform(frame, target) }) }}
      transition={{ duration: reducedMotion ? 0 : .55, ease: "easeInOut" }}>
      <path className="atlas-chain-land" d={dots} />
    </motion.g>
  </AnimatePresence>;
}


function ChainReview({ chain }: { chain: AtlasSelectedChain }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="atlas-scope-trigger atlas-chain-review-trigger" aria-label="Scope & review" title="Scope & review" aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); dialog.current?.showModal(); }}>?</button>
    <dialog ref={dialog} className="atlas-scope-dialog atlas-chain-review" aria-label="Scope & review" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Tab") { event.preventDefault(); dialog.current?.querySelector('button')?.focus(); }
    }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.currentTarget.close();
    }}>
      <header><div><span>Scope & review</span><h2>{chain.label}</h2></div><button autoFocus aria-label="Close scope and review" onClick={() => dialog.current?.close()}><X size={18} aria-hidden /></button></header>
      <div className="atlas-scope-body">
        <section><h3>Scope</h3><p>{chain.scope}</p></section>
        <section><h3>Review</h3><p>{chain.membership_review}</p></section>
        {chain.uncertainty && <section><h3>Uncertainty</h3><p>{chain.uncertainty}</p></section>}
        <p className="atlas-chain-reviewed"><CalendarDays size={14} aria-hidden />Source-checked draft · {formatDate(chain.reviewed_at)}</p>
      </div>
    </dialog>
  </>;
}
