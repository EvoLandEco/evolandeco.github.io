"use client";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, animate, motion, useMotionValue, usePresence, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { ArrowLeft, ArrowRight, Building2, Check, ChevronsDown, CircleHelp, Expand, FileText, Focus, GitBranch, Link2, MoveUpRight, RotateCcw, ScanLine, Share2 } from 'lucide-react';
import { relationshipNetwork, relationshipOverview, relationshipSources, relationshipGroupFilter, relationshipGroupLayout, relationshipNodeOutline, relationshipRing, relationshipMorphArc, relationshipSourceColors, relationshipSourceMarks, relationshipCallout, type RelationshipGraph, type RelationshipGroup } from '@/lib/atlas-relationship-network';
import { formatDate, supported, type AtlasAssessment } from '@/lib/atlas';
import { useAtlas } from './atlas-context';
import { usePanelMotion } from './motion-policy';
import { useElementSize } from './use-element-size';
import { AtlasConnectionCards } from './atlas-connection-cards';
import { cardTransitionClips, clipCardTransition } from './atlas-card-transition';
import styles from './atlas-relationship-network.module.css';

const typeLabel = (type: string) => type.charAt(0).toUpperCase() + type.slice(1).replaceAll('_', ' ');
export const relationshipIcons = { transmission: GitBranch, exposure: Focus, identity: Link2, unresolved: CircleHelp, movement: MoveUpRight };
const tone = (type: string) => ({ transmission: 'sage', exposure: 'blue', identity: 'violet', unresolved: 'coral', movement: 'teal' })[type] ?? 'blue';

export function AtlasRelationships({ entries, recordIds, selectedId, onSelect, onReport, onLocate, renderDetails }: {
  entries: AtlasAssessment[]; recordIds: Set<string>; selectedId: string; onSelect: (id: string) => void;
  onReport: (ids: string[]) => void; onLocate: (track: string) => void; renderDetails: (entry: AtlasAssessment) => ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const active = useRef<{ transition: ViewTransition; clear: () => void } | null>(null);
  const pagePosition = useRef(0);
  const entry = entries.find(entry => entry.id === expanded && entry.id === selectedId);
  if (expanded && !entry) setExpanded(null);
  useEffect(() => () => { active.current?.transition.skipTransition(); active.current?.clear(); }, []);
  const changeDetails = useCallback((id: string | null) => {
    const card = () => (root.current!.querySelector<HTMLElement>('.atlas-connection[data-expanded]') ?? root.current!.querySelector<HTMLElement>('[aria-label="Selected relationship"]'))!;
    const update = () => {
      flushSync(() => setExpanded(id));
      if (!id) window.scrollTo({ top: pagePosition.current, behavior: 'instant' });
      root.current?.querySelector<HTMLButtonElement>(id ? '[data-card-back]' : '[data-card-expand]')?.focus({ preventScroll: true });
    };
    active.current?.transition.skipTransition(); active.current?.clear(); active.current = null;
    if (id) {
      pagePosition.current = window.scrollY;
      if (!root.current?.closest('.atlas-page[data-fullscreen]')) root.current?.closest('.atlas-analysis')?.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { update(); return; }
    const named = new Set<HTMLElement>();
    const name = () => {
      const element = card();
      element.style.viewTransitionName = 'atlas-connection-card'; named.add(element);
      for (const [selector, part] of [['h3', 'heading'], ['[data-card-part="control"]', 'control'], ['[data-card-part="route"]', 'route']]) {
        const child = element.querySelector<HTMLElement>(selector);
        if (child) { child.style.viewTransitionName = `atlas-connection-${part}`; named.add(child); }
      }
    };
    document.documentElement.dataset.atlasConnectionTransition = id ? 'expand' : 'collapse';
    name();
    const before = cardTransitionClips(card());
    let after = before;
    const transition = document.startViewTransition(() => { named.forEach(element => element.style.removeProperty('view-transition-name')); update(); name(); after = cardTransitionClips(card()); });
    const clearClips = clipCardTransition(transition, before, () => after);
    const clear = () => { clearClips(); named.forEach(element => element.style.removeProperty('view-transition-name')); delete document.documentElement.dataset.atlasConnectionTransition; };
    active.current = { transition, clear };
    const finish = () => { if (active.current?.transition === transition) { clear(); active.current = null; } };
    void transition.finished.then(finish, finish);
  }, []);
  return <div ref={root} className={styles.workspace}>
    <div className={styles.networkView} data-obscured={!!entry} inert={!!entry} aria-hidden={!!entry || undefined}>
      <RelationshipNetwork entries={entries} recordIds={recordIds} selectedId={selectedId} onSelect={onSelect} onReport={onReport} onLocate={onLocate} onDetails={changeDetails} visible={!entry}/>
    </div>
    {entry && <div className={styles.expandedDetail}><AtlasConnectionCards key={entry.id} ids={[entry.id]} selectedId={entry.id} label="Network" onReturn={() => changeDetails(null)}>{renderDetails(entry)}</AtlasConnectionCards></div>}
  </div>;
}

const RelationshipNetwork = memo(function RelationshipNetwork({ entries, recordIds, selectedId, onSelect, onReport, onLocate, onDetails, visible }: {
  entries: AtlasAssessment[]; recordIds: Set<string>; selectedId: string; onSelect: (id: string) => void;
  onReport: (ids: string[]) => void; onLocate: (track: string) => void; onDetails: (id: string) => void; visible: boolean;
}) {
  const { lookup, sourceName } = useAtlas();
  const root = useRef<HTMLDivElement>(null);
  const motionPolicy = usePanelMotion(root, true);
  const { ref: stage, size } = useElementSize<HTMLDivElement>();
  const graph = useMemo(() => relationshipNetwork(entries, lookup, recordIds), [entries, lookup, recordIds]);
  const byId = useMemo(() => new Map(entries.map(entry => [entry.id, entry])), [entries]);
  const groups = useMemo(() => new Map(graph.groups.map(group => [group.id, group])), [graph]);
  const sources = useMemo(() => relationshipSources(graph, lookup), [graph, lookup]);
  const colors = useMemo(() => relationshipSourceColors([...sources.values()].flat()), [sources]);
  const [filters, setFilters] = useState<{ types: string[]; sources: string[] }>({ types: [], sources: [] });
  const selection = useMemo(() => relationshipGroupFilter(graph, byId, sources, filters.types, filters.sources), [graph, byId, sources, filters]);
  const filtering = !!(filters.types.length || filters.sources.length);
  const height = size ? 1000 * size.height / size.width : 700;
  const fullOverview = useMemo(() => relationshipOverview(graph, byId, 1000, height), [graph, byId, height]);
  const bubbles = useMemo(() => filtering ? relationshipOverview(selection, byId, 1000, height, Math.max(...fullOverview.map(group => group.radius)))
    : fullOverview, [selection, byId, height, filtering, fullOverview]);
  const descriptionId = useId();
  const [overview, setOverview] = useState(!selectedId);
  const [expandedGroup, setExpandedGroup] = useState(graph.groupByEntry.get(selectedId) ?? '');
  const [inspection, setInspection] = useState<{ kind: 'group' | 'relationship' | 'report'; id: string }>({ kind: 'relationship', id: selectedId });
  const [groupHover, setGroupHover] = useState({ pointer: '', focus: '' });
  const hoveredGroup = groupHover.pointer || groupHover.focus;
  const hoverGroup = useCallback((id: string, kind: 'pointer' | 'focus') => setGroupHover(current => current[kind] === id ? current : { ...current, [kind]: id }), []);
  const [previousId, setPreviousId] = useState(selectedId);
  if (previousId !== selectedId) { setPreviousId(selectedId); setExpandedGroup(graph.groupByEntry.get(selectedId) ?? ''); setOverview(!selectedId); setInspection({ kind: 'relationship', id: selectedId }); setFilters({ types: [], sources: [] }); }
  const filterGroups = useCallback((kind: 'types' | 'sources', value: string) => {
    setFilters(current => ({ ...current, [kind]: current[kind].includes(value) ? current[kind].filter(item => item !== value) : [...current[kind], value] }));
    setOverview(true); setGroupHover({ pointer: '', focus: '' });
  }, []);
  const clearFilters = () => { setFilters({ types: [], sources: [] }); setOverview(true); setGroupHover({ pointer: '', focus: '' }); };
  const selected = byId.get(selectedId) ?? entries[0];
  const focused = !overview ? groups.get(expandedGroup) : undefined;
  const select = useCallback((id: string) => {
    setGroupHover({ pointer: '', focus: '' }); setOverview(false); setExpandedGroup(graph.groupByEntry.get(id)!); setPreviousId(id); setInspection({ kind: 'relationship', id }); onSelect(id);
  }, [graph.groupByEntry, onSelect]);
  const openGroup = useCallback((id: string) => {
    setGroupHover({ pointer: '', focus: '' }); setOverview(false); setExpandedGroup(graph.groupByEntry.get(id)!); setInspection({ kind: 'group', id });
  }, [graph.groupByEntry]);
  const inspectReport = useCallback((id: string) => setInspection({ kind: 'report', id }), []);
  const selectedNode = focused?.nodes.find(node => node.kind === inspection.kind && node.reference === inspection.id)?.id ?? '';
  const hoveredIndex = !focused ? bubbles.findIndex(group => group.id === hoveredGroup) : -1;
  const hovered = bubbles[hoveredIndex];

  return <div ref={root} className={styles.network} data-playing={visible && motionPolicy.playing} onKeyDown={event => {
    if (event.key === 'Escape' && (focused || hovered)) {
      event.preventDefault(); event.stopPropagation(); setGroupHover({ pointer: '', focus: '' });
      if (focused) setOverview(true);
    }
  }}>
    <div className={styles.canvasPane}>
      <div className={styles.canvasTools}>
        <h3 className={styles.canvasTitle}>{focused ? <Expand size={13} aria-hidden/> : <Share2 size={13} aria-hidden/>}{focused ? 'Expanded group' : 'Evidence groups'}</h3>
        <button className={styles.filterReset} aria-label="Clear group filters" disabled={!filtering} onClick={clearFilters}><RotateCcw size={13} aria-hidden/></button>
      </div>
      <div ref={stage} className={styles.stage} data-focused={!!focused}>
        {size && <NetworkScene graph={graph} byId={byId} sources={sources} overview={bubbles} descriptionId={descriptionId} focused={focused} height={height} selectedNode={selectedNode} onSelect={select} onInspectReport={inspectReport} onOpenGroup={openGroup} onGroupHover={hoverGroup}/>}
        {hovered && size && <GroupCallout key={hovered.id} id={`${descriptionId}-${hoveredIndex}`} group={hovered} frame={size}
          sources={sources.get(hovered.id)!.map(sourceName).join(' + ')} reports={groups.get(hovered.id)!.nodes.filter(node => node.kind === 'report').length}/>}
        {!selection.groups.length && <div className={styles.empty}><Share2 size={26}/><p>No groups match this selection.</p>{filtering && <button onClick={clearFilters}>Clear group filters</button>}</div>}
      </div>
      <div className={styles.canvasFooter} data-focused={!!focused}><button className={styles.returnGroups} onClick={() => setOverview(true)}><ArrowLeft size={13} aria-hidden/>All groups</button>
      <div className={styles.legend} role="group" aria-label="Filter groups by relationship type"><span className={styles.reportKey}><FileText size={12} aria-hidden/>Report</span>{[...selection.typeCounts].sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => {
        const Icon = relationshipIcons[type as keyof typeof relationshipIcons] ?? Share2;
        return <button key={type} data-tone={tone(type)} aria-label={`Filter ${typeLabel(type)} groups`} aria-pressed={filters.types.includes(type)} disabled={!count && !filters.types.includes(type)} onClick={() => filterGroups('types', type)}><Icon size={12} aria-hidden/>{typeLabel(type)}<b>{count}</b></button>;
      })}</div></div>
    </div>
    {!focused ? <NetworkSummary selection={selection} sources={sources} colors={colors} hoveredGroup={hoveredGroup} selectedSources={filters.sources} onFilter={filterGroups}/> : !selectedNode ?
      <GroupDetail key={focused.id} group={focused} graph={graph} byId={byId} onInspectReport={inspectReport} onReport={onReport}/> : inspection.kind === 'report' ?
      <ReportDetail key={inspection.id} documentId={inspection.id} graph={graph} byId={byId} onSelect={select} onReport={onReport}/> :
      selected && <RelationshipDetail key={selected.id} selected={selected} recordIds={recordIds} onReport={onReport} onLocate={onLocate} onDetails={onDetails}/>}
  </div>;
});

const NetworkScene = memo(function NetworkScene({ graph, byId, sources, overview, descriptionId, focused, height, selectedNode, onSelect, onInspectReport, onOpenGroup, onGroupHover }: {
  graph: RelationshipGraph; byId: Map<string, AtlasAssessment>; focused: RelationshipGroup | undefined; height: number;
  sources: ReturnType<typeof relationshipSources>;
  overview: ReturnType<typeof relationshipOverview>; descriptionId: string;
  selectedNode: string; onSelect: (id: string) => void; onInspectReport: (id: string) => void; onOpenGroup: (id: string) => void; onGroupHover: (id: string, kind: 'pointer' | 'focus') => void;
}) {
  const patternId = useId();
  const { atlasDocuments } = useAtlas();
  const dates = useMemo(() => new Map([...atlasDocuments].map(([id, doc]) => [id, doc.publication])), [atlasDocuments]);
  const origin = overview.find(group => group.id === focused?.id);
  const [retainedId, setRetainedId] = useState('');
  if (focused && retainedId !== focused.id) setRetainedId(focused.id);
  const layout = useMemo(() => focused && relationshipGroupLayout(focused, byId, dates), [focused, byId, dates]);
  const [settledId, setSettledId] = useState('');
  const onSettled = useCallback((id: string) => setSettledId(id), []);
  const transitioning = focused ? settledId !== focused.id : !!retainedId;
  return <div className={styles.scene} role="img" aria-label="Relationship evidence network" data-transitioning={transitioning}>
    <svg viewBox={`0 0 1000 ${height}`} className={styles.graph} aria-hidden>
      <defs><pattern id={patternId} width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="14" cy="14" r=".6" className={styles.gridDot}/></pattern></defs>
      <rect width="1000" height={height} fill={`url(#${patternId})`}/>
    </svg>
    <div className={styles.overviewLayer} inert={!!focused || !!retainedId} aria-hidden={!!focused || !!retainedId || undefined}>
      <svg viewBox={`0 0 1000 ${height}`} className={styles.graph}>
        <g transform={`translate(500 ${height / 2})`}><NetworkOverview overview={overview} sources={sources} descriptionId={descriptionId} retainedId={retainedId} onSelect={onOpenGroup} onHover={onGroupHover}/></g>
      </svg>
    </div>
    <AnimatePresence initial={false} onExitComplete={() => { setRetainedId(focused?.id ?? ''); setSettledId(''); }}>
      {focused && layout && origin && <FocusedGroup key={focused.id} origin={origin} layout={layout} height={height} graph={graph} byId={byId} selectedNode={selectedNode} onSelect={onSelect} onInspectReport={onInspectReport} onSettled={onSettled}/>}
    </AnimatePresence>
  </div>;
});

const NetworkOverview = memo(function NetworkOverview({ overview, sources, descriptionId, retainedId, onSelect, onHover }: {
  overview: ReturnType<typeof relationshipOverview>; descriptionId: string; retainedId: string; onSelect: (id: string) => void; onHover: (id: string, kind: 'pointer' | 'focus') => void;
  sources: ReturnType<typeof relationshipSources>;
}) {
  const { reportOrganizations } = useAtlas();
  const paintId = useId();
  const rings = useMemo(() => overview.map(group => relationshipRing(group.radius, group.parts)), [overview]);
  const marks = useMemo(() => new Map([...sources].map(([id, publishers]) => [id, relationshipSourceMarks(publishers)])), [sources]);
  const glyphs = useMemo(() => overview.map((group, index) => {
      const primaryType = group.parts.reduce((largest, part) => part.fraction > largest.fraction ? part : largest).type;
      const publishers = sources.get(group.id)!;
      const names = publishers.map(source => reportOrganizations[source].label).join(' + ');
      return <g key={group.id} role="button" tabIndex={0} aria-label={`Explore evidence group ${index + 1}: ${group.count} connection${group.count === 1 ? '' : 's'}${names ? ` · ${names}` : ''}`} aria-describedby={`${descriptionId}-${index}`} className={styles.groupGlyph} data-tone={tone(primaryType)}
        onPointerEnter={() => onHover(group.id, 'pointer')} onPointerLeave={() => onHover('', 'pointer')}
        onFocus={event => onHover(event.currentTarget.matches(':focus-visible') ? group.id : '', 'focus')} onBlur={() => onHover('', 'focus')}
        onClick={() => onSelect(group.first)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(group.first); } }}>
        <circle r={group.radius} className={styles.groupSurface}/>
        {rings[index].parts.map((part, segment) => <g key={part.type} data-tone={tone(part.type)}>
          <defs><clipPath id={`${paintId}-${index}-${segment}`}><path d={part.clip}/></clipPath></defs>
          <path d={part.path} strokeWidth={rings[index].width} clipPath={`url(#${paintId}-${index}-${segment})`} className={styles.groupRing}/>
        </g>)}
        <g className={styles.groupCore}>
          {publishers.length ? marks.get(group.id)!.map(mark => <g key={mark.source}
            transform={`translate(${mark.x * group.radius * .5} ${mark.y * group.radius * .5}) scale(${mark.scale * group.radius * .5})`}><SourceLogo logo={reportOrganizations[mark.source].logo}/></g>) : <circle r={group.radius * .42} className={styles.sourceUnknown}/>}
        </g>
        <circle r={group.radius + 3} className={styles.groupFocus}/>
      </g>;
    }), [overview, sources, reportOrganizations, descriptionId, onHover, onSelect, rings, marks, paintId]);
  return <g className={styles.overviewArt}>{overview.map((group, index) => <g key={group.id} transform={`translate(${group.x} ${group.y})`} visibility={group.id === retainedId ? 'hidden' : undefined}>{glyphs[index]}</g>)}</g>;
});

function GroupCallout({ id, group, frame, sources, reports }: {
  id: string; group: ReturnType<typeof relationshipOverview>[number]; frame: { width: number; height: number }; sources: string; reports: number;
}) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const scale = frame.width / 1000;
  const placement = size && relationshipCallout({ x: frame.width / 2 + group.x * scale, y: frame.height / 2 + group.y * scale, radius: group.radius * scale }, frame, size);
  return <div className={styles.groupCalloutLayer}>
    {placement && <svg className={styles.groupLeader} aria-hidden><path d={placement.path} pathLength="1"/><circle cx={placement.start.x} cy={placement.start.y} r="2"/></svg>}
    <div ref={ref} id={id} role="tooltip" className={styles.groupCallout} style={placement ? { left: placement.x, top: placement.y } : { visibility: 'hidden' }}>
      <div><strong>{sources || 'Evidence group'}</strong>
        <span>{group.count} connection{group.count === 1 ? '' : 's'} · {reports} report{reports === 1 ? '' : 's'}</span>
        <small><Expand size={11} aria-hidden/>Click to expand<ArrowRight size={11} aria-hidden/></small>
      </div>
    </div>
  </div>;
}

type GroupLayout = ReturnType<typeof relationshipGroupLayout>;
const FocusedGroup = memo(function FocusedGroup({ origin, layout, height, graph, byId, selectedNode, onSelect, onInspectReport, onSettled }: {
  layout: GroupLayout; height: number; onSettled: (id: string) => void; graph: RelationshipGraph; byId: Map<string, AtlasAssessment>;
  origin: ReturnType<typeof relationshipOverview>[number];
  selectedNode: string; onSelect: (id: string) => void; onInspectReport: (id: string) => void;
}) {
  const { atlasDocuments, lookup, englishTitle, sourceName, reportOrganizations } = useAtlas();
  const edgeClipId = useId();
  const reducedMotion = useReducedMotion();
  const [present, safeToRemove] = usePresence();
  const detail = useRef<SVGGElement>(null);
  const [frame, setFrame] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [settled, setSettled] = useState(false);
  const progress = useMotionValue(reducedMotion ? 1 : 0);
  useEffect(() => {
    if (!detail.current) return;
    // SVG bounds include the rendered labels and asymmetric sectors in local coordinates.
    const observer = new ResizeObserver(([entry]) => {
      const { x, y, width, height } = (entry.target as SVGGraphicsElement).getBBox();
      setFrame(current => current && current.x === x && current.y === y && current.width === width && current.height === height
        ? current : { x, y, width, height });
    });
    observer.observe(detail.current);
    return () => observer.disconnect();
  }, [layout]);
  useEffect(() => {
    if (!frame) return;
    const target = present ? 1 : 0;
    const animation = animate(progress, target, { duration: reducedMotion ? 0 : .48 * Math.abs(target - progress.get()), ease: [.22, .8, .2, 1],
      onComplete: () => { if (!present) safeToRemove?.(); else { setSettled(true); onSettled(origin.id); } } });
    return () => animation.stop();
  }, [present, progress, reducedMotion, safeToRemove, frame, onSettled, origin.id]);
  const interactive = present && settled;
  const center = frame ? { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 } : layout.center;
  const zoom = frame ? Math.min(1000 / (frame.width + 24), height / (frame.height + 24)) : Math.min(1000, height) / (2 * layout.radius);
  // Paint vectors at the largest camera scale so compositing never enlarges a low-resolution surface.
  const resolution = Math.max(1, zoom);
  const cameraX = useTransform(progress, value => `${50 - (origin.x + center.x) * zoom * value / 10}%`);
  const cameraY = useTransform(progress, value => `${50 - (origin.y + center.y) * zoom * value / height * 100}%`);
  const cameraScale = useTransform(progress, value => (1 + (zoom - 1) * value) / resolution);
  const ring = useMemo(() => relationshipRing(origin.radius, origin.parts), [origin]);
  const detailTransform = useTransform(progress, value => `scale(${ring.parts[0].radius / (layout.sectors[0].radius + 14) * (1 - value) + value})`);
  const detailOpacity = useTransform(progress, [0, .25, .8, 1], [0, 0, 1, 1]);
  const sourceOpacity = useTransform(progress, [0, .35, .85, 1], [1, 1, 0, 0]);
  const turn = 2 * Math.PI * Math.round((ring.parts[0].start - layout.sectors[0].start) / (2 * Math.PI));
  const [hover, setHover] = useState('');
  const [previousId, setPreviousId] = useState(selectedNode);
  if (previousId !== selectedNode) { setPreviousId(selectedNode); setHover(''); }
  const highlighted = graph.neighbors.has(hover) ? hover : selectedNode;
  const neighbors = graph.neighbors.get(highlighted);
  const nodes = useMemo(() => new Map(layout.nodes.map(node => {
    const assessment = node.kind === 'relationship' ? byId.get(node.reference)! : undefined;
    const doc = node.kind === 'report' ? atlasDocuments.get(node.reference)! : undefined;
    const reportIds = doc ? [...graph.reports.get(doc.id)!] : [];
    return [node.id, { ...node, type: assessment?.type, label: assessment ? assessment.status : englishTitle(doc!),
      sourceId: doc ? lookup.get(reportIds[0])!.source : '', source: doc ? sourceName(lookup.get(reportIds[0])!.source) : '', date: doc ? formatDate(doc.publication) : '' }];
  })), [layout, graph.reports, byId, atlasDocuments, lookup, sourceName, englishTitle]);
  const reportNodes = useMemo(() => [...nodes.values()].filter(node => node.kind === 'report'), [nodes]);
  const marks = useMemo(() => new Map(relationshipSourceMarks(reportNodes.map(node => node.sourceId)).map(mark => [mark.source, mark])), [reportNodes]);
  const renderNode = (id: string) => {
    const node = nodes.get(id)!;
    return <NetworkNode key={node.id} node={node} present={interactive} active={node.id === highlighted || !!neighbors?.has(node.id)} selected={node.id === selectedNode} onHover={setHover} onSelect={onSelect} onInspectReport={onInspectReport}/>;
  };
  return <motion.div className={styles.cameraLayer} data-settled={interactive} style={{ x: cameraX, y: cameraY, scale: cameraScale }}>
    <svg viewBox={`0 0 ${1000 / resolution} ${height / resolution}`} className={`${styles.graph} ${styles.focusLayer}`}>
    <g data-expanded-group={origin.id} transform={`translate(${origin.x} ${origin.y})`} aria-hidden={!present || undefined} pointerEvents={interactive ? 'auto' : 'none'}>
    {layout.sectors.map(sector => <MorphRing key={sector.type} from={ring.parts.find(part => part.type === sector.type)!}
      to={{ radius: sector.radius + 14, start: sector.start + turn, end: sector.end + turn }} width={ring.width} progress={progress} type={sector.type}/>)}
    <motion.g style={{ opacity: sourceOpacity }} pointerEvents="none" aria-hidden>
      {reportNodes.map(node => <MorphSource key={node.id} mark={marks.get(node.sourceId)!} node={node} radius={origin.radius} progress={progress} logo={reportOrganizations[node.sourceId].logo}/>)}
      {!reportNodes.length && <circle r={origin.radius * .42} className={styles.sourceUnknown}/>}
    </motion.g>
    <motion.g ref={detail} data-network-detail transform={detailTransform} style={{ opacity: detailOpacity }}>
      <defs><clipPath id={edgeClipId} clipPathUnits="userSpaceOnUse"><path d={layout.edgeClip} clipRule="evenodd" fillRule="evenodd"/></clipPath></defs>
      <g clipPath={`url(#${edgeClipId})`}>
        {layout.edges.map(edge => <NetworkEdge key={edge.id} edge={edge} active={edge.from === highlighted || edge.to === highlighted}/>)}
      </g>
      {layout.sectors.map((sector, index) => <g key={sector.type} data-tone={tone(sector.type)} className={styles.sector}>
        <path d={sector.arc} className={styles.sectorWash}/>
        <defs><path id={`${edgeClipId}-label-${index}`} d={sector.labelArc}/></defs>
        <text className={styles.sectorLabel}><textPath href={`#${edgeClipId}-label-${index}`} startOffset="50%">{typeLabel(sector.type)}</textPath></text>
        {sector.nodes.map(node => renderNode(node.id))}
      </g>)}
      <g className={styles.publications}>{reportNodes.map(node => renderNode(node.id))}</g>
    </motion.g>
    </g>
    </svg>
  </motion.div>;
});

function MorphRing({ from, to, width, progress, type }: {
  from: { radius: number; start: number; end: number }; to: typeof from; width: number; progress: MotionValue<number>; type: string;
}) {
  const path = useTransform(progress, value => relationshipMorphArc(from, to, value));
  const strokeWidth = useTransform(progress, [0, 1], [width, .65]);
  const opacity = useTransform(progress, [0, 1], [.65, .48]);
  return <g data-tone={tone(type)} className={styles.sector} aria-hidden><motion.path d={path} className={styles.morphRing} style={{ strokeWidth, opacity }}/></g>;
}

function MorphSource({ mark, node, radius, progress, logo }: {
  mark: ReturnType<typeof relationshipSourceMarks>[number]; node: { x: number; y: number }; radius: number; progress: MotionValue<number>; logo: string | undefined;
}) {
  const x = useTransform(progress, [0, 1], [mark.x * radius * .5, node.x]);
  const y = useTransform(progress, [0, 1], [mark.y * radius * .5, node.y]);
  const scale = useTransform(progress, [0, 1], [mark.scale * radius * .5, 12]);
  const transform = useTransform(() => `translate(${x.get()} ${y.get()}) scale(${scale.get()})`);
  return <motion.g transform={transform}><SourceLogo logo={logo}/></motion.g>;
}

function SourceLogo({ logo }: { logo: string | undefined }) {
  return logo
    ? <image href={`/logos/atlas/${logo}`} x={-.9} y={-.9} width={1.8} height={1.8} preserveAspectRatio="xMidYMid meet" className={styles.sourceLogo} aria-hidden/>
    : <Building2 x={-.9} y={-.9} width={1.8} height={1.8} strokeWidth={1.5} className={styles.sourceInstitution} aria-hidden/>;
}

type FocusedNode = GroupLayout['nodes'][number] & { type: string | undefined; label: string; sourceId: string; source: string; date: string };
const NetworkNode = memo(function NetworkNode({ node, present, active, selected, onHover, onSelect, onInspectReport }: {
  node: FocusedNode; present: boolean; active: boolean; selected: boolean; onHover: (id: string) => void;
  onSelect: (id: string) => void; onInspectReport: (id: string) => void;
}) {
  function select() { onHover(''); if (node.kind === 'relationship') onSelect(node.reference); else onInspectReport(node.reference); }
  const Icon = node.type ? relationshipIcons[node.type as keyof typeof relationshipIcons] ?? Share2 : FileText;
  return <g transform={`translate(${node.x} ${node.y})`} className={styles.node} data-kind={node.kind} data-tone={node.type ? tone(node.type) : 'blue'} data-active={active} data-selected={selected}
    role="button" tabIndex={present ? 0 : -1} aria-label={`${node.kind === 'relationship' ? 'Connection' : 'Report'}: ${node.label}`}
    onPointerEnter={() => onHover(node.id)} onPointerLeave={() => onHover('')} onFocus={() => onHover(node.id)} onBlur={() => onHover('')} onClick={select}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); } }}>
    <circle r={node.kind === 'report' ? 17 : 12} className={styles.nodeHalo}/>
    <path d={relationshipNodeOutline(node.kind, node.type ?? '')} className={styles.nodeCore}/>
    <Icon x={node.kind === 'report' ? -6 : -4} y={node.kind === 'report' ? -6 : -4} width={node.kind === 'report' ? 12 : 8} height={node.kind === 'report' ? 12 : 8} className={styles.nodeSymbol} aria-hidden/>
    {node.kind === 'report' && <text y="22" className={styles.nodeLabel}>{node.source}<tspan x="0" dy="7">{node.date}</tspan></text>}
  </g>;
});

const NetworkEdge = memo(function NetworkEdge({ edge, active }: { edge: GroupLayout['edges'][number]; active: boolean }) {
  return <g data-tone={tone(edge.type)} data-type={edge.type} data-active={active} className={styles.edge}>
    <path d={edge.path} className={styles.edgeGlow}/><path d={edge.path} className={styles.edgeLine}/>
    {active && <path d={edge.path} pathLength="1" className={styles.beam}/>}
  </g>;
});

function DetailPane({ label, color, actions, children }: { label: string; color: string; actions?: ReactNode; children: ReactNode }) {
  const scroll = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [more, setMore] = useState(false);
  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const update = () => {
      const next = Math.ceil(element.scrollTop) < element.scrollHeight - element.clientHeight;
      if (!next && document.activeElement === cue.current) element.focus({ preventScroll: true });
      setMore(next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    [...element.children].forEach(child => observer.observe(child));
    element.addEventListener('scroll', update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); };
  }, [children]);
  return <aside className={styles.detailPane} aria-label={label} data-tone={color}>
    <div className={styles.detailBody}>
      <div ref={scroll} id={id} className={styles.detail} role="region" aria-label={`${label} content`} tabIndex={0}>{children}</div>
      <button ref={cue} className="atlas-scroll-cue" data-more={more} tabIndex={more ? 0 : -1} aria-hidden={!more} aria-label="More information below" aria-controls={id} onClick={() => {
        scroll.current?.scrollBy({ top: scroll.current.clientHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      }}><ChevronsDown size={18} aria-hidden/></button>
    </div>
    {actions && <footer className={`atlas-card-footer ${styles.actions}`}>{actions}</footer>}
  </aside>;
}

function TypeProfile({ counts }: { counts: { type: string; count: number }[] }) {
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  return <div className={styles.typeProfile}>{counts.map(({ type, count }) => {
    const Icon = relationshipIcons[type as keyof typeof relationshipIcons] ?? Share2;
    return <div key={type} data-tone={tone(type)}><Icon size={13} aria-hidden/><span>{typeLabel(type)}</span><strong>{count}</strong><div className={styles.typeBar}><i style={{ width: `${count / total * 100}%` }}/></div></div>;
  })}</div>;
}

const NetworkSummary = memo(function NetworkSummary({ selection, sources, colors, hoveredGroup, selectedSources, onFilter }: {
  selection: ReturnType<typeof relationshipGroupFilter>; sources: ReturnType<typeof relationshipSources>; colors: Map<string, string>; hoveredGroup: string;
  selectedSources: string[]; onFilter: (kind: 'types' | 'sources', value: string) => void;
}) {
  const { reportOrganizations } = useAtlas();
  const publishers = useMemo(() => {
    const groups = new Map<string, number>();
    for (const members of sources.values()) for (const source of members) groups.set(source, (groups.get(source) ?? 0) + 1);
    return [...groups].sort(([a, n], [b, m]) => m - n || a.localeCompare(b)).map(([source]) => source);
  }, [sources]);
  const highlighted = new Set(sources.get(hoveredGroup));
  return <DetailPane label="Network overview" color="sage">
    <header><span className={styles.kind}><Share2 size={13} aria-hidden/>Overview</span></header>
    <h3>Evidence groups</h3>
    <div className={styles.figures}><span><strong>{selection.groups.length}</strong> groups</span><span><strong>{selection.entryCount}</strong> connections</span><span><strong>{selection.reportCount}</strong> reports</span></div>
    <TypeProfile counts={selection.counts}/>
    <h4 className={styles.sectionTitle}>Reporting sources</h4>
    <div className={styles.publisherKey} role="group" aria-label="Filter groups by reporting source" data-inspecting={!!hoveredGroup}>{publishers.map(source => {
      const organization = reportOrganizations[source];
      return <button key={source} style={{ '--source-color': colors.get(source) } as CSSProperties} data-highlighted={highlighted.has(source)}
        aria-label={`Filter ${organization.label} groups`} aria-pressed={selectedSources.includes(source)} disabled={!selection.sourceCounts.get(source) && !selectedSources.includes(source)} onClick={() => onFilter('sources', source)}>
        <svg viewBox="-1.1 -1.1 2.2 2.2" className={styles.sourceMark} aria-hidden><SourceLogo logo={organization.logo}/></svg>
        <span>{organization.label}</span>
        <Check size={11} className={styles.sourceCheck} aria-hidden/>
      </button>;
    })}</div>
  </DetailPane>;
});

const GroupDetail = memo(function GroupDetail({ group, graph, byId, onInspectReport, onReport }: {
  group: RelationshipGroup; graph: RelationshipGraph; byId: Map<string, AtlasAssessment>; onInspectReport: (id: string) => void; onReport: (ids: string[]) => void;
}) {
  const { atlasDocuments, lookup, sourceName, englishTitle } = useAtlas();
  const details = useMemo(() => {
    const entries = group.nodes.filter(node => node.kind === 'relationship').map(node => byId.get(node.reference)!);
    const reports = group.nodes.filter(node => node.kind === 'report').map(node => {
      const document = atlasDocuments.get(node.reference)!;
      const ids = [...graph.reports.get(document.id)!];
      return { document, ids, source: sourceName(lookup.get(ids[0])!.source) };
    }).sort((a, b) => b.document.publication.localeCompare(a.document.publication));
    const counts = new Map<string, number>();
    for (const entry of entries) counts.set(entry.type, (counts.get(entry.type) ?? 0) + 1);
    return { reports, connections: entries.length, topics: new Set(entries.map(entry => entry.track)).size,
      sources: [...new Set(reports.map(report => report.source))],
      counts: [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([type, count]) => ({ type, count })) };
  }, [group, graph.reports, byId, atlasDocuments, lookup, sourceName]);
  const newest = details.reports[0]?.document.publication;
  const oldest = details.reports.at(-1)?.document.publication;
  return <DetailPane label="Evidence group overview" color="sage" actions={!!details.reports.length && <button className="atlas-card-expand" onClick={() => onReport(details.reports.flatMap(report => report.ids))}><FileText size={14} aria-hidden/>View reports<ArrowRight size={14} aria-hidden/></button>}>
    <header><span className={styles.kind}><Share2 size={13} aria-hidden/>Group overview</span></header>
    <h3>{details.sources.join(' + ') || 'Relationships'}</h3>
    {newest && oldest && <p className={styles.status}>{formatDate(oldest)}{oldest !== newest && ` – ${formatDate(newest)}`}</p>}
    <div className={styles.figures}><span><strong>{details.connections}</strong> {details.connections === 1 ? 'connection' : 'connections'}</span><span><strong>{details.reports.length}</strong> {details.reports.length === 1 ? 'report' : 'reports'}</span><span><strong>{details.topics}</strong> {details.topics === 1 ? 'topic' : 'topics'}</span></div>
    <TypeProfile counts={details.counts}/>
    {!!details.reports.length && <><h4 className={styles.sectionTitle}>Supporting reports</h4><div className={styles.sources}>{details.reports.map(({ document, source }) =>
      <button key={document.id} aria-label={`Inspect report: ${englishTitle(document)}`} onClick={() => onInspectReport(document.id)}><FileText size={14} aria-hidden/><span><span className={styles.reportTitle}>{englishTitle(document)}</span><small>{source} · {formatDate(document.publication)}</small></span><ArrowRight size={13} aria-hidden/></button>
    )}</div></>}
  </DetailPane>;
});

const ReportDetail = memo(function ReportDetail({ documentId, graph, byId, onSelect, onReport }: {
  documentId: string; graph: RelationshipGraph; byId: Map<string, AtlasAssessment>; onSelect: (id: string) => void; onReport: (ids: string[]) => void;
}) {
  const { atlasDocuments, lookup, tracks, sourceName, englishTitle } = useAtlas();
  const document = atlasDocuments.get(documentId)!;
  const ids = [...graph.reports.get(documentId)!];
  const connections = [...graph.neighbors.get(`report:${documentId}`)!].map(id => byId.get(id.slice('relationship:'.length))!);
  return <DetailPane label="Selected report" color="blue" actions={<button className="atlas-card-expand" onClick={() => onReport(ids)}><FileText size={14} aria-hidden/>View report<ArrowRight size={14} aria-hidden/></button>}>
    <header><span className={styles.kind}><FileText size={13} aria-hidden/>Report</span></header>
    <h3>{englishTitle(document)}</h3>
    <p className={styles.status}>{sourceName(lookup.get(ids[0])!.source)} · {formatDate(document.publication)}</p>
    <div className={styles.figures}><span><strong>{connections.length}</strong> connections</span><span><strong>{ids.length}</strong> report entries</span><span><strong>{new Set(connections.map(entry => entry.track)).size}</strong> topics</span></div>
    <h4 className={styles.sectionTitle}>Connections</h4>
    <div className={`${styles.sources} ${styles.connectionList}`}>{connections.map(entry => {
      const Icon = relationshipIcons[entry.type as keyof typeof relationshipIcons] ?? Share2;
      return <button key={entry.id} data-tone={tone(entry.type)} onClick={() => onSelect(entry.id)}><Icon size={14} aria-hidden/><span>{tracks.get(entry.track)?.label ?? entry.track}<small>{entry.status}</small></span><ArrowRight size={13} aria-hidden/></button>;
    })}</div>
  </DetailPane>;
});

const RelationshipDetail = memo(function RelationshipDetail({ selected, recordIds, onReport, onLocate, onDetails }: {
  selected: AtlasAssessment; recordIds: Set<string>; onReport: (ids: string[]) => void; onLocate: (track: string) => void; onDetails: (id: string) => void;
}) {
  const { lookup, tracks, atlasDocuments, sourceName } = useAtlas();
  const Icon = relationshipIcons[selected.type as keyof typeof relationshipIcons] ?? Share2;
  const updates = selected.updates?.filter(update => supported(update.support, recordIds)) ?? [];
  const support = [...selected.support, ...updates.flatMap(update => update.support)];
  const supportingIds = [...new Set(support.map(([id]) => id))];
  const documents = [...new Set(supportingIds.map(id => lookup.get(id)!.document_id))].map(id => atlasDocuments.get(id)!);
  return <DetailPane label="Selected relationship" color={tone(selected.type)} actions={<><button className="atlas-card-expand" data-card-expand data-card-part="control" onClick={() => onDetails(selected.id)}><Expand size={14} aria-hidden/>View details<ArrowRight size={14} aria-hidden/></button><button aria-label="View supporting reports" onClick={() => onReport(supportingIds)}><FileText size={14} aria-hidden/></button><button aria-label="Locate selected relationship" onClick={() => onLocate(selected.track)}><ScanLine size={14} aria-hidden/></button></>}>
      <header><span className={styles.kind}><Icon size={13} aria-hidden/>{typeLabel(selected.type)}</span></header>
      <h3>{tracks.get(selected.track)?.label ?? selected.track}</h3>
      <p className={styles.status}>{selected.status}</p>
      {(selected.from || selected.to) && <div className={styles.endpoints} data-card-part="route">
        {selected.from && <div><span className={styles.endpointDot}/><p>{selected.from}</p></div>}
        {selected.from && selected.to && <div className={styles.connector}><span/><Icon size={15} aria-hidden/><span/></div>}
        {selected.to && <div><span className={styles.endpointDot}/><p>{selected.to}</p></div>}
      </div>}
      <div className={styles.figures}><span><strong>{documents.length}</strong> reports</span><span><strong>{new Set(support.map(([id, claim]) => `${id}:${claim}`)).size}</strong> source claims</span><span><strong>{updates.length}</strong> later assessments</span></div>
      <p className={styles.basis}>{selected.basis}</p>
      <div className={styles.sources}>{documents.map(document => <button key={document.id} onClick={() => onReport(supportingIds.filter(id => lookup.get(id)!.document_id === document.id))}><FileText size={14} aria-hidden/><span>{sourceName(lookup.get(supportingIds.find(id => lookup.get(id)!.document_id === document.id)!)!.source)}<small>{formatDate(document.publication)}</small></span><ArrowRight size={13} aria-hidden/></button>)}</div>
    </DetailPane>;
});
