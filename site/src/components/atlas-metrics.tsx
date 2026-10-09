import { SourceQuotation } from "./atlas-source-text";
import { motion, useReducedMotion } from "motion/react";
import { memo, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { AtlasScope } from "./atlas-scope";
import { AtlasDisclosure } from "./atlas-disclosure";
import { AtlasDetailStatus, useAtlasDetails } from "./atlas-detail";
import { CountryText } from "./atlas-location-badges";
import { useElementSize } from "./use-element-size";
import type { AtlasReviewedSeries } from "@/lib/atlas-contract";
import type { AtlasBrowserSeries } from "@/lib/atlas-vendor/browser/0.3/browser_transport.js";
import { useAtlas, useAtlasPanelState } from "./atlas-context";
import { GitBranch, ExternalLink, TriangleAlert } from "lucide-react";
import { visibleMeasure, metricValue, measureRecord, type Measure } from "@/lib/atlas-metrics";
import { revealAtlasEntries } from "@/lib/atlas-detail-scroll";
import { formatDate, sourceName } from "@/lib/atlas";

function MeasureDetails({ measure: m }: { measure: Measure }) {
  return <AtlasScope label="Scope & source" title={m.label}>
    <MeasureDetailContent measure={m} />
  </AtlasScope>;
}

function MeasureDetailContent({ measure }: { measure: Measure }) {
  const { data, error, retry } = useAtlasDetails([{ collection: "metrics.measures", id: measure.measure_id }]);
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  const m = data.get("metrics.measures", measure.measure_id);
  return <>
    <div className="atlas-scope-value"><strong>{metricValue(m)}</strong><p><CountryText>{[m.geography.value, m.period_label].filter(Boolean).join(" · ")}</CountryText></p></div>
    <div className="atlas-measure-details">
    <dl>{[["Count type", m.count_kind], ["Disease", m.disease.value], ["Population", m.population.value], ["Case definition", m.case_definition.value], ["Scope", m.stratum.value], ["Denominator", m.denominator === null ? null : String(m.denominator)], ["Denominator population", m.denominator_population.value], ["Authority", m.origin_authority.value]].filter(([, value]) => value !== null).map(([label, value]) => <div key={label}><dt>{label}</dt><dd><CountryText>{value}</CountryText></dd></div>)}</dl>
    {m.semantic_note && <p><CountryText>{m.semantic_note}</CountryText></p>}
    {m.source_date_warning && <span className="atlas-status" data-tone="warning"><TriangleAlert size={13} aria-hidden />Source date mismatch</span>}
    {m.evidence_references.map((ref, i) => <div key={i}>{ref.quotes.map((quote, j) => <SourceQuotation key={j} quote={quote} recordId={ref.record_id} claimIndex={ref.claim_index} quoteIndex={ref.quote_indexes[j]} />)}</div>)}
    <a href={m.source_url} target="_blank" rel="noopener noreferrer">{m.source_id} · {formatDate(m.publication)} <ExternalLink size={12} aria-hidden /></a>
    </div>
  </>;
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
  return <AtlasDisclosure className="atlas-observations" summary={<summary>Source observations <span>{series.length} series</span></summary>}>
    {() => <div className="atlas-observation-grid">{series.map(({ series, items }) => <ObservationPlot key={series.context_id} items={items} onReport={onReport} />)}</div>}
  </AtlasDisclosure>;
}

export function ObservationPlot({ items, onReport, series, seriesId, evidenceDialog = false, renderLayout }: { evidenceDialog?: boolean; seriesId?: string; items: Measure[]; onReport: (ids: string[], expand?: boolean) => void; series?: AtlasReviewedSeries | AtlasBrowserSeries; renderLayout?: (parts: { caption: ReactNode; plot: ReactNode; details: ReactNode }) => ReactNode }) {
  const reducedMotion = useReducedMotion();
  const transition = { duration: reducedMotion ? 0 : .45, ease: "easeInOut" as const };
  const { ref: chart, size } = useElementSize<SVGSVGElement>();
  const [selection, setSelection] = useAtlasPanelState<string | null>(`observations.${seriesId ?? items[0].measure_id}.selection`, null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [selectionSeries, setSelectionSeries] = useState(seriesId);
  if (selectionSeries !== seriesId) { setSelectionSeries(seriesId); setHovered(null); setFocused(null); }
  const details = useRef<HTMLDivElement>(null);
  const measuresById = useMemo(() => new Map(items.slice().reverse().map(item => [item.measure_id, item])), [items]);
  const connectionsById = useMemo(() => new Map(series?.connections.slice().reverse().map(connection => [connection.id, connection])), [series]);
  useEffect(() => {
    details.current?.scrollTo({ top: 0 });
  }, [selection, seriesId]);
  const hoverFigure = (id: string, focus = false) => {
    if (!focus && hovered === id) return;
    if (focus) { setFocused(id); setHovered(null); } else setHovered(id);
    const connection = connectionsById.get(id);
    revealAtlasEntries(details.current, connection ? [connection.from_measure_id, connection.to_measure_id] : [id]);
  };
  const edge = selection ? connectionsById.get(selection) : undefined;
  const selected = items.filter(m => edge ? m.measure_id === edge.from_measure_id || m.measure_id === edge.to_measure_id : m.measure_id === selection);
  const evidenceIds = edge?.evidence_ids ?? series?.members.find(m => m.measure_id === selection)?.evidence_ids ?? [];
  const left = 40, right = (size?.width ?? 0) - 16, bottom = (size?.height ?? 0) - 30;
  const plotHeight = bottom - 18;
  const { from, to, top, points } = useMemo(() => {
    const dates = items.map(m => Date.parse(m.observation_date!));
    const from = Math.min(...dates), to = Math.max(...dates), top = Math.max(...items.map(m => m.value!), 1);
    const points = new Map(items.map((m, i) => [m.measure_id, { x: left + (to === from ? .5 : (dates[i] - from) / (to - from)) * (right - left), y: bottom - m.value! / top * plotHeight }]));
    return { from, to, top, points };
  }, [items, right, bottom, plotHeight]);
  const highlightedEdges = series?.connections.filter(e => e.id === hovered || e.id === focused) ?? [];
  const highlighted = (id: string) => id === hovered || id === focused || highlightedEdges.some(edge => edge.from_measure_id === id || edge.to_measure_id === id);
  const hoveredMeasure = hovered ? measuresById.get(hovered) : undefined;
  const guide = points.get(hovered ?? focused ?? "");
  const comparisonEvidence = () => series && <><p>{series.reason}</p>
        {series.limitations.map(limit => <p key={limit} className="atlas-chart-note">{limit}</p>)}
        <p className="atlas-chart-note">Source-checked draft · {series.reviewed_by} · {formatDate(series.reviewed_at)}</p>
        <SeriesEvidence seriesId={series.series_id} evidenceIds={evidenceIds} onReport={onReport} />
      </>;
  const caption = <figcaption><strong>{items[0].label}{items[0].unit === "percent" ? " (%)" : ""}</strong><span>{items[0].disease.value} · {items[0].geography.value} · {items[0].count_kind === "interval" ? "Reporting period" : items[0].count_kind === "cumulative" ? "Cumulative" : "Reported values"}</span></figcaption>;
  const plot = <div className="atlas-observation-visual">
    <svg ref={chart} className="atlas-observation-chart" data-report-ready={Boolean(hoveredMeasure) || undefined} onClick={() => { if (hoveredMeasure) onReport([measureRecord(hoveredMeasure)], true); }} viewBox={size ? `0 0 ${size.width} ${size.height}` : undefined} onPointerLeave={() => setHovered(null)} onPointerMove={event => {
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
          initial={reducedMotion ? false : { d: `M${a.x} ${a.y}L${b.x} ${b.y}`, pathLength: 0, opacity: 0 }} animate={{ d: `M${a.x} ${a.y}L${b.x} ${b.y}`, pathLength: 1, opacity: 1 }} transition={transition} role="button" tabIndex={0} aria-label={`Comparison from ${formatDate(measuresById.get(connection.from_measure_id)!.observation_date!)} to ${formatDate(measuresById.get(connection.to_measure_id)!.observation_date!)}`}
          aria-pressed={selection === connection.id} onClick={event => { event.stopPropagation(); setSelection(connection.id); }} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelection(connection.id); } }} />;
      })}
      {items.map(m => <motion.circle key={m.measure_id} initial={reducedMotion ? false : { cx: points.get(m.measure_id)!.x, cy: points.get(m.measure_id)!.y, opacity: 0, r: 0 }} animate={{ cx: points.get(m.measure_id)!.x, cy: points.get(m.measure_id)!.y, r: 5, opacity: 1 }} transition={transition} data-conflict={Boolean(m.conflict_set)} data-highlighted={highlighted(m.measure_id) || undefined}
        onPointerMove={event => { event.stopPropagation(); hoverFigure(m.measure_id); }} onFocus={() => hoverFigure(m.measure_id, true)} onBlur={() => setFocused(current => current === m.measure_id ? null : current)}
        role="button" tabIndex={0} aria-label={`${metricValue(m)} · ${formatDate(m.observation_date!)} · ${sourceName(m.source_id)}. Open report`}
        onClick={event => { event.stopPropagation(); onReport([measureRecord(m)], true); }}
        onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onReport([measureRecord(m)], true); } }}><title>{metricValue(m)} · {m.observation_date} · {m.source_id}</title></motion.circle>)}
      <text x={left} y={size.height - 8}>{formatDate(new Date(from).toISOString())}</text><text x={right} y={size.height - 8} textAnchor="end">{formatDate(new Date(to).toISOString())}</text>
      </>}
    </svg>
    </div>;
  const sourceDetails = <motion.div key={seriesId} ref={details} initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={transition} className="atlas-observation-details" role="region" aria-label="Observation details" tabIndex={0}>
    {series && selected.length > 0 && <div className="atlas-observation-selection" aria-label="Selected observation evidence">
      {selected.map(m => <ObservationRow key={m.measure_id} measure={m} onReport={onReport} highlighted={highlighted(m.measure_id)} onHover={setHovered} onFocus={setFocused} publication />)}
      {evidenceDialog ? <AtlasScope label="Comparison method & evidence" title={series.label} buttonLabel="Comparison evidence">{comparisonEvidence}</AtlasScope>
        : <AtlasDisclosure unmountOnClose summary={<summary>Comparison method & evidence</summary>}>{comparisonEvidence}</AtlasDisclosure>}
    </div>}
    <div className="atlas-observation-values" role="group" aria-label="Values & sources">{items.filter(m => !selected.includes(m)).map(m => <ObservationRow key={m.measure_id} measure={m} onReport={onReport} highlighted={highlighted(m.measure_id)} onHover={setHovered} onFocus={setFocused} />)}</div>
    </motion.div>;
  return renderLayout ? renderLayout({ caption, plot, details: sourceDetails }) : <figure>{caption}{plot}{sourceDetails}</figure>;
}


function SeriesEvidence({ seriesId, evidenceIds, onReport }: { seriesId: string; evidenceIds: string[]; onReport: (ids: string[]) => void }) {
  const { atlasDocuments } = useAtlas();
  const { data, error, retry } = useAtlasDetails([{ collection: "metrics.reviewed_series", id: seriesId }]);
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  const evidence = data.get("metrics.reviewed_series", seriesId).evidence.filter(row => evidenceIds.includes(row.id));
  return evidence.map(e => <div key={e.id}><strong>{e.section}{e.page === null ? "" : ` · p. ${e.page}`}</strong><SourceQuotation quote={e.quote} evidenceId={e.id} />
    <button className="atlas-observation-source" onClick={() => onReport([e.record_id])}>{atlasDocuments.get(e.document_id)!.title} <ExternalLink size={12} aria-hidden /></button></div>);
}

export const ObservationRow = memo(function ObservationRow({ measure: m, onReport, publication = false, highlighted, onHover, onFocus }: { measure: Measure; onReport: (ids: string[], expand?: boolean) => void; publication?: boolean; highlighted: boolean; onHover: Dispatch<SetStateAction<string | null>>; onFocus: Dispatch<SetStateAction<string | null>> }) {
  return <div className="atlas-observation-item" data-entry-id={m.measure_id} data-highlighted={highlighted || undefined}
    onPointerMove={() => onHover(m.measure_id)} onPointerLeave={() => onHover(current => current === m.measure_id ? null : current)}
    onFocus={() => { onFocus(m.measure_id); onHover(null); }} onBlur={() => onFocus(current => current === m.measure_id ? null : current)}>
    <button className="atlas-observation-source atlas-observation-row" onClick={() => onReport([measureRecord(m)])}>
      <span className="atlas-observation-date"><time>{formatDate(m.observation_date!)}</time><small>{m.period_label}{publication && ` · Published ${formatDate(m.publication)}`}{m.conflict_set && " · Conflicting totals"}</small></span>
      <strong>{metricValue(m)}</strong><span className="atlas-observation-authority">{sourceName(m.source_id)}</span>
    </button>
    <MeasureDetails measure={m} />
  </div>;
});
