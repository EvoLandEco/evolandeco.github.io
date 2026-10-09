import { SourceQuotation } from "./atlas-source-text";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EvidenceSummary } from "./atlas-evidence-summary";
import { AtlasDisclosure } from "./atlas-disclosure";
import { AtlasDetailStatus, useAtlasDetails } from "./atlas-detail";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowRight, CalendarDays, Clock3, ChevronDown, FileText, GitBranch, MapPin, MapPinOff, Route, X } from "lucide-react";
import { useAtlas, useAtlasPanelState } from "./atlas-context";
import { useElementSize } from "./use-element-size";
import { AtlasEntryFilters } from "./atlas-entry-filters";
import { AtlasSelect } from "./atlas-select";
import { ChainEvidenceCards } from "./atlas-chain-evidence-cards";
import { LocationBadges } from "./atlas-location-badges";
import { fitChainMap, chainLandDots, chainEdgeGeometry, chainBadgePosition, chainMapTransform, chainCurveBounds, placeChainInset, chainTimeConnector } from "@/lib/atlas-chain-map";
import { revealAtlasEntries } from "@/lib/atlas-detail-scroll";
import { dayNumber, formatDate } from "@/lib/atlas";
import type { AtlasSelectedChain, AtlasChainKind } from "@/lib/atlas-contract";

const kinds: Record<AtlasChainKind, string> = {
  established_transmission: "Source-established transmission", contact_exposure: "Reported contacts & exposure",
  travel_itinerary: "Reported journey", reporting_sequence: "Selected report sequence",
};

export function AtlasChains({ chains, onReport }: { chains: AtlasSelectedChain[]; onReport: (ids: string[]) => void }) {
  const { ref: toolbar, size: toolbarSize } = useElementSize<HTMLElement>();
  const [choice, setChoice] = useAtlasPanelState("trends.chain", "chain_be0dfd16da910b21c44e15c2");
  const [filters, setFilters] = useAtlasPanelState<string[]>("geographic.chainFilters", []);
  const matching = chains.filter(chain => !filters.length || filters.includes(chain.kind));
  const chain = matching.find(c => c.id === choice) ?? matching[0];
  if (!chains.length) return null;
  return <section id="atlas-journeys" className="atlas-chain-section" aria-labelledby="atlas-chains-title" style={toolbarSize ? { "--atlas-journey-tools-height": `${toolbarSize.height}px` } as CSSProperties : undefined}>
    <h2 id="atlas-chains-title" className="sr-only">Event sequences</h2>
    <header ref={toolbar} className="atlas-chain-toolbar atlas-entry-tools atlas-panel-tools"><div className="atlas-chain-heading atlas-oh-view-select"><AtlasSelect label="Journey view" disabled value="sequences" onChange={() => {}} items={[{ value: "sequences", label: "Event sequences" }]} summaryLabel={<span className="atlas-oh-mode-label"><GitBranch size={14} aria-hidden /><span>Sequences</span></span>} /></div>
    <div className="atlas-chain-tools atlas-entry-tools"><AtlasSelect label="Reviewed chain" searchable disabled={!chain} value={chain?.id ?? ""} onChange={setChoice} summaryLabel={<span className="atlas-select-choice"><span className="atlas-select-choice-title">{chain?.label ?? "No matching connections"}</span><small className="atlas-select-count" title={`${matching.length} journeys and connections`}>{matching.length}</small></span>} items={matching.map(c => ({ value: c.id, label: c.label, badges: [
      { kind: "kind", label: kinds[c.kind] },
      { kind: "count", label: `${c.nodes.length} ${c.nodes.length === 1 ? "event" : "events"}` },
      ...(c.nodes.some(n => !n.place_id) ? [{ kind: "place" as const, label: `${c.nodes.filter(n => !n.place_id).length} unlocated` }] : []),
    ] }))} /><AtlasEntryFilters label="Filter geographic connections" value={filters} onChange={setFilters} count={matching.length} total={chains.length} groups={[
      { label: "Connection type", match: "any", items: Object.entries(kinds).map(([value, label]) => ({ value, label })) },
    ]} /></div></header>
    {chain ? <ChainFigure chain={chain} onReport={onReport} /> : <p className="atlas-empty">No connections match these filters. Clear the entry filters or choose another type.</p>}
  </section>;
}

function ChainFigure({ chain, onReport }: { chain: AtlasSelectedChain; onReport: (ids: string[]) => void }) {
  const { bundle } = useAtlas();
  const arrow = useId();
  const timeArrow = useId();
  const reducedMotion = useReducedMotion();
  const transition = { duration: reducedMotion ? 0 : .55, ease: "easeInOut" as const };
  const { ref: map, size } = useElementSize<SVGSVGElement>();
  const { ref: timePlot, size: timeSize } = useElementSize<SVGSVGElement>();
  const entryCount = chain.nodes.length + chain.edges.length;
  const details = useRef<HTMLDivElement>(null);
  const selection = useRef<HTMLDivElement>(null);
  const nodesGroup = useRef<HTMLDetailsElement>(null);
  const routesGroup = useRef<HTMLDetailsElement>(null);
  const [selected, setSelected] = useAtlasPanelState(`chain.${chain.id}.selection`, "");
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
    onPointerEnter: () => figure ? hoverFigure(id) : setHovered(id), onPointerLeave: () => setHovered(current => current === id ? "" : current),
    onFocus: () => { if (figure) hoverFigure(id, true); else { setFocused(id); setHovered(""); } }, onBlur: () => setFocused(current => current === id ? "" : current),
  });
  const [selectionChain, setSelectionChain] = useState(chain.id);
  if (selectionChain !== chain.id) { setSelectionChain(chain.id); setHovered(""); setFocused(""); }
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
    const scale = Math.max(1, (padding.x * 2 + 30) / size.width, (padding.y * 2 + 30) / size.height);
    let mapWidth = size.width * scale, height = size.height * scale;
    let frame = fitChainMap(locations, mapWidth, height, padding);
    const centers = locations.map(p => ({ ...p, ...frame!.project(p) }));
    const separation = Math.max(1, ...centers.flatMap((a, i) => centers.slice(i + 1).map(b =>
      (a.radius + b.radius + (a.radius || b.radius ? 164 : 32)) / Math.hypot(a.x - b.x, a.y - b.y))));
    if (separation > 1) {
      mapWidth = size.width * scale * separation;
      height = size.height * scale * separation;
      frame = fitChainMap(locations, mapWidth, height, padding);
    }
    const clusters = locations.map(p => ({ ...p, ...frame!.project(p) }));
    const members = clusters.flatMap(p => p.ids.map((id, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / p.ids.length;
      return { id, number: p.numbers[index], cluster: p.ids.length > 1 ? p.ids.join() : undefined,
        x: p.x + p.radius * Math.cos(angle), y: p.y + p.radius * Math.sin(angle), unlocated: false };
    }));
    const locatedRoutes = chain.edges.filter(edge => chain.drawable_edge_ids.includes(edge.id)).flatMap(edge => {
      const a = members.find(pin => pin.id === edge.from_node_id), b = members.find(pin => pin.id === edge.to_node_id);
      if (!a || !b) return [];
      const curve = chainEdgeGeometry(a, b);
      return curve ? [{ edge, ...curve }] : [];
    });
    const badges = members.map(pin => chainBadgePosition(pin, locatedRoutes.flatMap(route => {
      const endpoint = route.edge.from_node_id === pin.id ? route.start : route.edge.to_node_id === pin.id ? route.end : null;
      return endpoint ? [{ x: route.control.x - endpoint.x, y: route.control.y - endpoint.y }] : [];
    }), bundle.places.find(place => place.id === chain.nodes[pin.number - 1].place_id)!.area_codes.length * 54, 24,
    clusters.find(cluster => cluster.ids.length > 1 && cluster.ids.includes(pin.id))));
    const columns = Math.min(Math.ceil(Math.sqrt(unlocated.length)), Math.max(1, Math.floor((mapWidth - 44) / 50)));
    const insetWidth = Math.max(110, columns * 50 + 24);
    const insetOffset = (index: number) => ({ x: insetWidth / 2 + (index % columns - (columns - 1) / 2) * 50, y: 61 + Math.floor(index / columns) * 50 });
    const inset = unlocated.length ? placeChainInset(mapWidth, height, { width: insetWidth, height: 46 + Math.ceil(unlocated.length / columns) * 50 }, [
      ...members.map(pin => ({ x: pin.x - 31, y: pin.y - 31, width: 62, height: 62 })),
      ...badges.filter(badge => badge.width > 0).map(badge => ({ x: badge.x - 8, y: badge.y - 8, width: badge.width + 16, height: badge.height + 16 })),
      ...locatedRoutes.map(chainCurveBounds),
    ], chain.edges.flatMap(edge => {
      const outgoing = unlocated.some(node => node.id === edge.from_node_id);
      const index = unlocated.findIndex(node => node.id === (outgoing ? edge.from_node_id : edge.to_node_id));
      const located = members.find(pin => pin.id === (outgoing ? edge.to_node_id : edge.from_node_id));
      return index >= 0 && located ? [{ located, offset: insetOffset(index), outgoing }] : [];
    })) : null;
    return { frame, height, width: mapWidth, clusters: clusters.filter(p => p.ids.length > 1), badges,
      pins: [...members, ...unlocated.map((node, index) => ({ id: node.id, number: chain.nodes.indexOf(node) + 1,
        x: inset!.x + insetOffset(index).x, y: inset!.y + insetOffset(index).y, cluster: undefined, unlocated: true }))],
      inset, dots: frame ? chainLandDots(frame) : "" };
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
  const badges = geography?.badges ?? [];
  const activate = (id: string) => {
    const group = chain.nodes.some(node => node.id === id) ? nodesGroup.current : routesGroup.current;
    if (group) group.open = true;
    setSelected(current => current === id ? "" : id);
  };
  const dated = chain.nodes.flatMap((node, index) => node.event_date.status === "reported" && node.event_date.value
    ? [{ node, number: index + 1, date: node.event_date.value, day: dayNumber(node.event_date.value) }] : []).sort((a, b) => a.day - b.day);
  const undated = chain.nodes.filter(node => !dated.some(event => event.node.id === node.id));
  const first = dated[0], last = dated.at(-1);
  const renderEvidence = (item: AtlasSelectedChain["nodes"][number] | AtlasSelectedChain["edges"][number]) => selected === item.id && <div ref={selection} className="atlas-chain-evidence" role="region" aria-label="Selected chain evidence">
    <p>{"membership_basis" in item ? item.membership_basis : item.basis}</p>
    {"place_id" in item && <p className="atlas-chart-note">{[item.coordinate_precision, item.location_note, item.date_note].filter(Boolean).join(" · ")}</p>}
    {item.uncertainty && <p className="atlas-chart-note">{item.uncertainty}</p>}
    <button onClick={() => onReport(item.record_ids)}><FileText size={14} aria-hidden />View reports</button>
    <AtlasDisclosure unmountOnClose summary={<EvidenceSummary kind="source" />}>{() => <ChainSourceEvidence ids={item.evidence_ids} />}</AtlasDisclosure>
  </div>;
  return <figure className="atlas-chain-figure" data-kind={chain.kind} aria-label={chain.label}>
    <div className="atlas-chain-map-panel">
    <header className="atlas-chain-panel-heading"><h3><MapPin size={14} aria-hidden />Location references</h3></header>
    <motion.svg ref={map} className="atlas-chain-map" initial={false} animate={{ viewBox: geography ? `0 0 ${geography.width} ${geography.height}` : undefined }} transition={transition} role="group" aria-label={`Map of ${chain.label}`}>
      {geography && <>
      <defs><marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M2 2L8 5L2 8" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></marker></defs>
      <ChainLand frame={geography.frame} dots={geography.dots} reducedMotion={Boolean(reducedMotion)} />
      {geography.inset && <motion.g className="atlas-chain-unlocated-zone" initial={false} animate={{ x: geography.inset.x, y: geography.inset.y }} transition={transition}>
        <rect width={geography.inset.width} height={geography.inset.height} rx="14" />
        <text x={geography.inset.width / 2} y="26" textAnchor="middle">Unlocated</text>
      </motion.g>}
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
    <section className="atlas-chain-timing" aria-label="Event timing">
      <header className="atlas-chain-panel-heading"><h3><Clock3 size={14} aria-hidden />Event timing</h3><span>{dated.length} of {chain.nodes.length} dated</span></header>
      <div className="atlas-chain-timing-scroll" tabIndex={0}>
      {first && last && <>
        <div className="atlas-chain-time-plot">
        <svg ref={timePlot} className="atlas-chain-time-links" aria-hidden="true">
          <defs><marker id={timeArrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" markerUnits="userSpaceOnUse" orient="auto"><path d="M2 1L6 4L2 7" /></marker></defs>
          {timeSize && dated.slice(1).map((event, index) => <path key={event.node.id} className="atlas-chain-time-link" markerEnd={`url(#${timeArrow})`} d={chainTimeConnector(
            { x: first.day === last.day ? timeSize.width / 2 : (dated[index].day - first.day) / (last.day - first.day) * timeSize.width, y: index * 44 + 22 },
            { x: first.day === last.day ? timeSize.width / 2 : (event.day - first.day) / (last.day - first.day) * timeSize.width, y: (index + 1) * 44 + 22 },
          )} />)}
        </svg>
        <ol className="atlas-chain-time-rows">{dated.map(({ node, number, date, day }) => <li key={node.id}>
          <button className="atlas-chain-time-event" {...hoverProps(node.id, true)} aria-label={`${node.label} · ${node.date_basis} · ${formatDate(date)}`} aria-pressed={selected === node.id} onClick={() => activate(node.id)} style={{ "--event-time": `${first.day === last.day ? 50 : (day - first.day) / (last.day - first.day) * 100}%` } as CSSProperties}>
            <span className="atlas-chain-time-basis">{node.date_basis === "unknown" ? "Unspecified" : node.date_basis}</span>
            <span className="atlas-chain-time-track" aria-hidden><span>{number}</span></span>
            <time dateTime={date}>{formatDate(date).replace(/ \d{4}$/, "")}</time>
          </button>
        </li>)}</ol>
        </div>
        <div className="atlas-chain-time-axis" data-single={first.day === last.day || undefined}><time dateTime={first.date}>{formatDate(first.date)}</time>{first.day !== last.day && <time dateTime={last.date}>{formatDate(last.date)}</time>}</div>
      </>}
      {undated.length > 0 && <div className="atlas-chain-undated"><span>No reported date</span><div>{undated.map(node => <button key={node.id} {...hoverProps(node.id, true)} aria-label={`${node.label} · date ${node.event_date.status.replaceAll("_", " ")}`} aria-pressed={selected === node.id} title={node.label} onClick={() => activate(node.id)}><span className="atlas-chain-number">{chain.nodes.indexOf(node) + 1}</span></button>)}</div></div>}
      </div>
    </section>
    <motion.div key={chain.id} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={transition} className="atlas-chain-details" role="region" aria-label="Journey details">
    <section ref={details} className="atlas-chain-outline" aria-label="Journey events and connections" tabIndex={0}>
    <header className="atlas-chain-panel-heading"><h3><Route size={14} aria-hidden />Journey outline</h3><span>{entryCount} {entryCount === 1 ? "entry" : "entries"}</span></header>
    {!chain.selection_complete && <span className="atlas-status">Partial selection</span>}
    <details ref={nodesGroup} className="atlas-chain-group" open onToggle={event => { if (event.target === event.currentTarget && !event.currentTarget.open && chain.nodes.some(node => node.id === selected)) setSelected(""); }}>
      <summary><MapPin size={14} aria-hidden /><span>Events</span><small>{chain.nodes.length}</small><ChevronDown size={14} aria-hidden /></summary>
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
      <summary><GitBranch size={14} aria-hidden /><span>Connections</span><small>{chain.edges.length}</small><ChevronDown size={14} aria-hidden /></summary>
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
    </section>
    <ChainEvidenceCards key={chain.id} chain={chain} selected={selected} onReport={onReport} />
    </motion.div>
  </figure>;
}

function ChainSourceEvidence({ ids }: { ids: string[] }) {
  const { atlasDocuments, englishTitle } = useAtlas();
  const { data, error, retry } = useAtlasDetails(ids.map(id => ({ collection: "evidence", id })));
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  return ids.map(id => {
    const entry = data.get("evidence", id), report = atlasDocuments.get(entry.document_id)!;
    return <div key={id}><SourceQuotation quote={entry.quote} evidenceId={entry.id} /><a href={report.url} target="_blank" rel="noopener noreferrer">{englishTitle(report)} · {formatDate(report.publication)}</a></div>;
  });
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
