import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AtlasScope } from "./atlas-scope";
import { CountryText } from "./atlas-location-badges";
import { useElementSize } from "./use-element-size";
import type { AtlasReviewedSeries } from "@/lib/atlas-contract";
import { useAtlas } from "./atlas-context";
import { GitBranch, ExternalLink, TriangleAlert, X } from "lucide-react";
import { visibleMeasure, metricValue, type Measure } from "@/lib/atlas-metrics";
import { revealAtlasEntries } from "@/lib/atlas-detail-scroll";
import { formatDate, sourceName } from "@/lib/atlas";

function MeasureDetails({ measure: m }: { measure: Measure }) {
  const content = <>
    <dl>{[["Count type", m.count_kind], ["Disease", m.disease.value], ["Population", m.population.value], ["Case definition", m.case_definition.value], ["Scope", m.stratum.value], ["Denominator", m.denominator === null ? null : String(m.denominator)], ["Denominator population", m.denominator_population.value], ["Authority", m.origin_authority.value]].filter(([, value]) => value !== null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd><CountryText>{value}</CountryText></dd></div>)}</dl>
    {m.semantic_note && <p><CountryText>{m.semantic_note}</CountryText></p>}
    {m.source_date_warning && <span className="atlas-status" data-tone="warning"><TriangleAlert size={13} aria-hidden />Source date mismatch</span>}
    {m.evidence_references.map((ref, i) => <div key={i}>{ref.quotes.map((quote, j) => <blockquote key={j}><CountryText>{quote}</CountryText></blockquote>)}</div>)}
    <a href={m.source_url} target="_blank" rel="noopener noreferrer">{m.source_id} · {formatDate(m.publication)} <ExternalLink size={12} aria-hidden /></a>
  </>;
  return <AtlasScope label="Scope & source" title={m.label}>
    <div className="atlas-scope-value"><strong>{metricValue(m)}</strong><p><CountryText>{[m.geography.value, m.period_label].filter(Boolean).join(" · ")}</CountryText></p></div>
    <div className="atlas-measure-details">{content}</div>
  </AtlasScope>;
}

export function MetricFigures({ kind, ids, recordIds, compact = false, exclude }: { kind: string; ids: string[]; recordIds: Set<string>; compact?: boolean; exclude?: Set<string> }) {
  const { panelMeasures, compactPanelFigures } = useAtlas();
  const shown = compact ? compactPanelFigures(kind, ids, recordIds)
    : panelMeasures(kind, ids, recordIds).filter(m => !exclude?.has(m.measure_id)).map(m => [m]);
  if (!shown.length) return null;
  const contexts = shown.map(([m]) => [m.geography.value,
    compact ? m.count_kind === "point" ? "Reported" : m.count_kind === "interval" ? "In period" : "Cumulative" : null,
    m.period_label || (m.observation_date ? formatDate(m.observation_date) : null)].filter(Boolean).join(" · "));
  const sharedContext = shown.length > 1 && contexts.every(context => context === contexts[0]);
  return <div className="atlas-metrics" data-compact={compact} aria-label="Source-reported figures">
    {sharedContext && <p className="atlas-metric-context"><CountryText>{contexts[0]}</CountryText></p>}
    {shown.map((group, index) => {
      const m = group[0];
      return <div className="atlas-measure" key={group.map(m => m.measure_id).join(":")}>
      <strong>{metricValue(m)}</strong><div className="atlas-measure-heading"><span className="atlas-measure-label"><CountryText>{m.label}</CountryText></span></div>
      {!compact && <MeasureDetails measure={m} />}
      {!sharedContext && <small><CountryText>{contexts[index]}</CountryText></small>}
      {compact && <small className="atlas-measure-sources">{[...new Set(group.map(m => sourceName(m.source_id)))].join(" · ")}</small>}
      {m.conflict_set && <span className="atlas-status" data-tone="warning"><GitBranch size={12} aria-hidden />Conflicting totals</span>}
    </div>;
    })}
  </div>;
}

export function ObservationHistory({ topicIds, recordIds, onReport }: { topicIds: string[]; recordIds: Set<string>; onReport: (ids: string[], expand?: boolean) => void }) {
  const { metrics, measures } = useAtlas();
  const series = metrics.series.map(series => ({ series, items: series.measure_ids.map(id => measures.get(id)!).filter(m => topicIds.includes(m.track_id) && visibleMeasure(m, recordIds) && m.observation_date !== null && m.value !== null && !m.superseded) }))
    .filter(({ items }) => new Set(items.map(m => m.observation_date)).size > 1);
  if (!series.length) return null;
  return <details className="atlas-observations"><summary>Source observations <span>{series.length} series</span></summary>
    <div className="atlas-observation-grid">{series.map(({ series, items }) => <ObservationPlot key={series.context_id} items={items} onReport={onReport} />)}</div>
  </details>;
}

export function ObservationPlot({ items, onReport, series, seriesId }: { seriesId?: string; items: Measure[]; onReport: (ids: string[], expand?: boolean) => void; series?: AtlasReviewedSeries }) {
  const reducedMotion = useReducedMotion();
  const transition = { duration: reducedMotion ? 0 : .45, ease: "easeInOut" as const };
  const { ref: chart, size } = useElementSize<SVGSVGElement>();
  const { atlasDocuments } = useAtlas();
  const [selection, setSelection] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selectionSeries, setSelectionSeries] = useState(seriesId);
  if (selectionSeries !== seriesId) { setSelectionSeries(seriesId); setSelection(null); setHovered(null); setFocused(null); }
  const details = useRef<HTMLDivElement>(null);
  useEffect(() => {
    details.current?.scrollTo({ top: 0 });
  }, [selection, seriesId]);
  const hoverFigure = (id: string, focus = false) => {
    if (focus) { setFocused(id); setHovered(null); } else setHovered(id);
    const connection = series?.connections.find(edge => edge.id === id);
    revealAtlasEntries(details.current, connection ? [connection.from_measure_id, connection.to_measure_id] : [id]);
  };
  const edge = series?.connections.find(e => e.id === selection);
  const selected = items.filter(m => edge ? m.measure_id === edge.from_measure_id || m.measure_id === edge.to_measure_id : m.measure_id === selection);
  const evidenceIds = edge?.evidence_ids ?? series?.members.find(m => m.measure_id === selection)?.evidence_ids ?? [];
  const evidence = series?.evidence.filter(e => evidenceIds.includes(e.id)) ?? [];
  const dates = items.map(m => Date.parse(m.observation_date!));
  const from = Math.min(...dates), to = Math.max(...dates), top = Math.max(...items.map(m => m.value!), 1);
  const left = 40, right = (size?.width ?? 0) - (series ? 44 : 16), bottom = (size?.height ?? 0) - 30;
  const plotHeight = bottom - 18;
  const points = new Map(items.map((m, i) => [m.measure_id, { x: left + (to === from ? .5 : (dates[i] - from) / (to - from)) * (right - left), y: bottom - m.value! / top * plotHeight }]));
  const highlightedEdges = series?.connections.filter(e => e.id === hovered || e.id === focused) ?? [];
  const highlighted = (id: string) => id === hovered || id === focused || highlightedEdges.some(edge => edge.from_measure_id === id || edge.to_measure_id === id);
  const hoveredMeasure = items.find(m => m.measure_id === hovered);
  const guide = points.get(hovered ?? focused ?? "");
  return <figure>
    <figcaption><strong>{items[0].label}{items[0].unit === "percent" ? " (%)" : ""}</strong><span>{items[0].disease.value} · {items[0].geography.value} · {items[0].count_kind === "interval" ? "Reporting period" : items[0].count_kind === "cumulative" ? "Cumulative" : "Reported values"}</span></figcaption>
    <div className="atlas-observation-visual">
    {series && <SeriesReview key={seriesId} series={series} />}
    <svg ref={chart} className="atlas-observation-chart" data-report-ready={Boolean(hoveredMeasure) || undefined} onClick={() => { if (hoveredMeasure) onReport([hoveredMeasure.source_reference.record_id], true); }} viewBox={size ? `0 0 ${size.width} ${size.height}` : undefined} onPointerLeave={() => setHovered(null)} onPointerMove={event => {
      if (event.pointerType === "touch") return;
      const svg = event.currentTarget, matrix = svg.getScreenCTM();
      if (!matrix) return;
      const cursor = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
      const nearest = items.reduce((a, b) => {
        const pa = points.get(a.measure_id)!, pb = points.get(b.measure_id)!;
        const dx = Math.abs(pb.x - cursor.x) - Math.abs(pa.x - cursor.x);
        return dx < 0 || (dx === 0 && Math.abs(pb.y - cursor.y) < Math.abs(pa.y - cursor.y)) ? b : a;
      });
      hoverFigure(nearest.measure_id);
    }} role="group" aria-label={`${items[0].label}: ${series ? "reviewed reporting series" : "separate source observations"}`}>
      {size && <>
      {[0, .5, 1].map(fraction => <g key={fraction}><path d={`M${left} ${bottom - fraction * plotHeight}H${right}`} className="atlas-observation-axis" /><text x={left - 8} y={bottom + 4 - fraction * plotHeight} textAnchor="end">{new Intl.NumberFormat("en", { notation: "compact" }).format(top * fraction)}</text></g>)}
      {guide && <path className="atlas-observation-guide" d={`M${guide.x} 18V${bottom}`} aria-hidden="true" />}
      {series?.connections.map(connection => {
        const a = points.get(connection.from_measure_id)!, b = points.get(connection.to_measure_id)!;
        return <motion.path key={connection.id} className="atlas-observation-connection" data-connection={connection.id} data-highlighted={hovered === connection.id || focused === connection.id || undefined}
          onPointerMove={event => { event.stopPropagation(); hoverFigure(connection.id); }} onFocus={() => hoverFigure(connection.id, true)} onBlur={() => setFocused(current => current === connection.id ? null : current)}
          initial={reducedMotion ? false : { d: `M${a.x} ${a.y}L${b.x} ${b.y}`, pathLength: 0, opacity: 0 }} animate={{ d: `M${a.x} ${a.y}L${b.x} ${b.y}`, pathLength: 1, opacity: 1 }} transition={transition} role="button" tabIndex={0} aria-label={`Comparison from ${formatDate(items.find(m => m.measure_id === connection.from_measure_id)!.observation_date!)} to ${formatDate(items.find(m => m.measure_id === connection.to_measure_id)!.observation_date!)}`}
          aria-pressed={selection === connection.id} onClick={event => { event.stopPropagation(); setSelection(connection.id); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelection(connection.id); } }} />;
      })}
      {items.map(m => <motion.circle key={m.measure_id} initial={reducedMotion ? false : { cx: points.get(m.measure_id)!.x, cy: points.get(m.measure_id)!.y, opacity: 0, r: 0 }} animate={{ cx: points.get(m.measure_id)!.x, cy: points.get(m.measure_id)!.y, r: 5, opacity: 1 }} transition={transition} data-conflict={Boolean(m.conflict_set)} data-highlighted={highlighted(m.measure_id) || undefined}
        onPointerMove={event => { event.stopPropagation(); hoverFigure(m.measure_id); }} onFocus={() => hoverFigure(m.measure_id, true)} onBlur={() => setFocused(current => current === m.measure_id ? null : current)}
        role="button" tabIndex={0} aria-label={`${metricValue(m)} · ${formatDate(m.observation_date!)} · ${sourceName(m.source_id)}. Open report`}
        onClick={event => { event.stopPropagation(); onReport([m.source_reference.record_id], true); }}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onReport([m.source_reference.record_id], true); } }}><title>{metricValue(m)} · {m.observation_date} · {m.source_id}</title></motion.circle>)}
      <text x={left} y={size.height - 8}>{formatDate(new Date(from).toISOString())}</text><text x={right} y={size.height - 8} textAnchor="end">{formatDate(new Date(to).toISOString())}</text>
      </>}
    </svg>
    </div>
    <motion.div key={seriesId} ref={details} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={transition} className="atlas-observation-details" role="region" aria-label="Observation details" tabIndex={0}>
    {series && selected.length > 0 && <div className="atlas-observation-selection" aria-label="Selected observation evidence">
      {selected.map(m => <ObservationRow key={m.measure_id} measure={m} onReport={onReport} highlighted={highlighted(m.measure_id)} onHover={setHovered} onFocus={setFocused} publication />)}
      <details><summary>Comparison method & evidence</summary><p>{series.reason}</p>
        {series.limitations.map(limit => <p key={limit} className="atlas-chart-note">{limit}</p>)}
        <p className="atlas-chart-note">Source-checked draft · {series.reviewed_by} · {formatDate(series.reviewed_at)}</p>
        {evidence.map(e => <div key={e.id}><strong>{e.section}{e.page === null ? "" : ` · p. ${e.page}`}</strong><blockquote>{e.quote}</blockquote>
          <button className="atlas-observation-source" onClick={() => onReport([e.record_id])}>{atlasDocuments.get(e.document_id)!.title} <ExternalLink size={12} aria-hidden /></button></div>)}
      </details>
    </div>}
    <div className="atlas-observation-values" role="group" aria-label="Values & sources">{items.filter(m => !selected.includes(m)).map(m => <ObservationRow key={m.measure_id} measure={m} onReport={onReport} highlighted={highlighted(m.measure_id)} onHover={setHovered} onFocus={setFocused} />)}</div>
    </motion.div>
  </figure>;
}


function ObservationRow({ measure: m, onReport, publication = false, highlighted, onHover, onFocus }: { measure: Measure; onReport: (ids: string[], expand?: boolean) => void; publication?: boolean; highlighted: boolean; onHover: Dispatch<SetStateAction<string | null>>; onFocus: Dispatch<SetStateAction<string | null>> }) {
  return <div className="atlas-observation-item" data-entry-id={m.measure_id} data-highlighted={highlighted || undefined}
    onPointerMove={() => onHover(m.measure_id)} onPointerLeave={() => onHover(current => current === m.measure_id ? null : current)}
    onFocus={() => { onFocus(m.measure_id); onHover(null); }} onBlur={() => onFocus(current => current === m.measure_id ? null : current)}>
    <button className="atlas-observation-source atlas-observation-row" onClick={() => onReport([m.source_reference.record_id])}>
      <span className="atlas-observation-date"><time>{formatDate(m.observation_date!)}</time><small>{m.period_label}{publication && ` · Published ${formatDate(m.publication)}`}{m.conflict_set && " · Conflicting totals"}</small></span>
      <strong>{metricValue(m)}</strong><span className="atlas-observation-authority">{sourceName(m.source_id)}</span>
    </button>
    <MeasureDetails measure={m} />
  </div>;
}

function SeriesReview({ series }: { series: AtlasReviewedSeries }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="atlas-scope-trigger atlas-series-review-trigger" aria-label="Series scope" title="Series scope" aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); dialog.current?.showModal(); }}>?</button>
    <dialog ref={dialog} className="atlas-scope-dialog" aria-label="Series scope" onKeyDown={event => {
      event.stopPropagation();
      if (event.key === "Tab") { event.preventDefault(); dialog.current?.querySelector('button')?.focus(); }
    }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) event.currentTarget.close();
    }}>
      <header><div><span>Series scope</span><h2>{series.label}</h2></div><button autoFocus aria-label="Close series scope" onClick={() => dialog.current?.close()}><X size={18} aria-hidden /></button></header>
      <div className="atlas-scope-body atlas-series-scope"><p>{series.scope}</p></div>
    </dialog>
  </>;
}
