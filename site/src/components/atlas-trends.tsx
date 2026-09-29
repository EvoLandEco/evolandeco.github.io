import { memo, useId, useMemo, useState, type CSSProperties } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Activity, ChartNoAxesCombined, ChartPie, GitBranch } from "lucide-react";
import { useAtlas } from "./atlas-context";
import { AtlasChains } from "./atlas-chains";
import { AtlasSelect } from "./atlas-select";
import { ObservationPlot } from "./atlas-metrics";
import { visibleMeasure } from "@/lib/atlas-metrics";
import type { AtlasRecord } from "@/lib/atlas";

export const AtlasTrends = memo(function AtlasTrends({ rows, window, onReport }: { rows: AtlasRecord[]; window: [string, string]; onReport: (ids: string[], expand?: boolean) => void }) {
  const { metrics, measures, atlasDocuments, selectedResearch } = useAtlas();
  const [context, setContext] = useState("");
  const [panel, setPanel] = useState("journeys");
  const data = useMemo(() => {
    const ids = new Set(rows.map(r => r.id));
    const view = selectedResearch(ids);
    const eligible = new Set(view.panels.flatMap(p => p.measure_ids));
    const reviewed = view.reviewed_series;
    const reviewedIds = new Set(reviewed.flatMap(s => s.members.map(m => m.measure_id)));
    const selected = metrics.measures.filter(m => eligible.has(m.measure_id) && visibleMeasure(m, ids) && !m.superseded);
    const measured = new Set(selected.flatMap(m => m.evidence_references.map(ref => ref.record_id)));
    const unreviewed = metrics.series.map(s => ({ id: s.context_id, review: undefined, items: s.measure_ids.map(id => measures.get(id)!).filter(m => !reviewedIds.has(m.measure_id) && eligible.has(m.measure_id) && visibleMeasure(m, ids) && !m.superseded && m.value !== null && m.observation_date !== null).sort((a, b) => a.observation_date!.localeCompare(b.observation_date!)) }))
      .filter(s => new Set(s.items.map(m => m.observation_date)).size > 1);
    const series = [...reviewed.map(review => ({ id: review.series_id, review, items: review.members.map(m => measures.get(m.measure_id)!) })), ...unreviewed];
    const months = [];
    const cursor = new Date(`${window[0].slice(0, 7)}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= window[1].slice(0, 7)) {
      const month = cursor.toISOString().slice(0, 7);
      const records = rows.filter(r => atlasDocuments.get(r.document_id)!.publication.startsWith(month));
      months.push({ month, records, count: new Set(records.map(r => r.document_id)).size });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return { composition: view.disease_composition, chains: view.reviewed_chains, series, months, measured: view.numeric_coverage?.records_with_measures ?? measured.size, documents: new Set(rows.map(r => r.document_id)).size };
  }, [rows, window, metrics, measures, atlasDocuments, selectedResearch]);
  const selected = data.series.find(s => s.id === context) ?? data.series[0];
  const peak = Math.max(1, ...data.months.map(m => m.count));
  const coverage = rows.length ? data.measured / rows.length * 100 : 0;
  return <div className="atlas-trends" data-panel={panel}>
    <div className="atlas-trend-overview">
      <section className="atlas-trend-activity" aria-labelledby="atlas-activity-title">
        <header><Activity size={17} aria-hidden /><h2 id="atlas-activity-title">Reporting activity</h2><strong>{data.documents}<small> reports</small></strong></header>
        <div className="atlas-activity-bars">{data.months.map(({ month, records, count }) => <button key={month} disabled={!count} aria-label={`${month}: ${count} reports. View reports`} onClick={() => onReport(records.map(r => r.id))}>
          <span className="atlas-activity-track"><span style={{ height: `calc((100% - 20px) * ${count / peak})` }} /><b>{count}</b></span>
          <span>{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01`))}<small>{month.slice(0, 4)}</small></span>
        </button>)}</div>
      </section>
      <section className="atlas-trend-coverage" aria-labelledby="atlas-coverage-title">
        <header><ChartPie size={17} aria-hidden /><h2 id="atlas-coverage-title">{data.composition ? "Reporting attention" : "Figure coverage"}</h2></header>
        {data.composition ? <DiseaseRing composition={data.composition} onReport={onReport} /> : <>
        <svg viewBox="10 10 124 124" role="img" aria-label={`${data.measured} of ${rows.length} records have extracted figures`}>
          <circle cx="72" cy="72" r="58" className="atlas-coverage-track" />
          <circle cx="72" cy="72" r="58" pathLength="100" strokeDasharray={`${coverage} ${100 - coverage}`} transform="rotate(-90 72 72)" className="atlas-coverage-value" />
          <text x="72" y="72" textAnchor="middle">{data.measured}<tspan x="72" dy="19">of {rows.length} records</tspan></text>
        </svg></>}
      </section>
    </div>
    {data.chains.length > 0 && <div className="atlas-trend-switch" role="group" aria-label="Trend figure">
      <button aria-pressed={panel === "journeys"} aria-controls="atlas-journeys" onClick={() => setPanel("journeys")}><GitBranch size={15} aria-hidden />Journeys</button>
      <button aria-pressed={panel === "observations"} aria-controls="atlas-observation-panel" onClick={() => setPanel("observations")}><ChartNoAxesCombined size={15} aria-hidden />Observations</button>
    </div>}
    <AtlasChains chains={data.chains} onReport={onReport} />
    <section id="atlas-observation-panel" className="atlas-trend-observations" aria-labelledby="atlas-observations-title">
      <header><ChartNoAxesCombined size={18} aria-hidden /><h2 id="atlas-observations-title">Reported observations</h2><span>{data.series.length} series</span></header>
      {selected ? <>
        <AtlasSelect label="Observation series" searchable value={selected.id} onChange={setContext} items={data.series.map(s => {
          const measure = s.items[0];
          return { value: s.id, label: s.review?.label ?? [measure.disease.value, measure.geography.value, measure.label, measure.count_kind].filter(Boolean).join(" · "), title: measure.label,
            badges: [
              ...(measure.disease.value ? [{ kind: "disease" as const, label: measure.disease.value }] : []),
              ...(measure.geography.value ? [{ kind: "place" as const, label: measure.geography.value }] : []),
              { kind: "period" as const, label: measure.count_kind === "interval" ? "Per reporting period" : measure.count_kind === "cumulative" ? "Cumulative" : "Reported values" },
            ] };
        })} />
        <div className="atlas-observation-grid"><ObservationPlot seriesId={selected.id} series={selected.review} items={selected.items} onReport={onReport} /></div>
      </> : <p className="atlas-empty">No observations across multiple dates in this selection. Try a wider reporting window or another topic.</p>}
    </section>
  </div>;
});


function DiseaseRing({ composition, onReport }: { composition: import("@/lib/atlas-contract").AtlasDiseaseComposition; onReport: (ids: string[]) => void }) {
  const clipId = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const categories = composition.categories.filter(c => c.count > 0).sort((a,b) => b.count-a.count);
  const palette = Array.from({length:6}, (_, i)=>`var(--attention-${i+1})`);
  const slices = categories.slice(0,5);
  if (categories.length > 5) slices.push({ id: "other", label: "Other report subjects", kind: "other", count: categories.slice(5).reduce((sum,c)=>sum+c.count,0), proportion: null, record_ids: categories.slice(5).flatMap(c=>c.record_ids) });
  const active = slices.find(slice=>slice.id===hovered);
  const percent = (count: number) => new Intl.NumberFormat("en-GB", {style:"percent",maximumFractionDigits:1}).format(count/composition.denominator);
  return <div className="atlas-disease-ring" data-highlighted={!!active}><Tooltip.Provider delayDuration={120}><Tooltip.Root onOpenChange={open=>{if(!open)setHovered(null);}}>
    <Tooltip.Trigger asChild><svg viewBox="10 10 124 124" role="group" aria-label={`Reporting attention by subject across ${composition.denominator} report entries; not disease incidence`}>
      <circle cx="72" cy="72" r="58" className="atlas-coverage-track" />
      {slices.map((category, index) => {
        const portion = category.count / composition.denominator;
        const start = slices.slice(0, index).reduce((sum, slice) => sum + slice.count, 0) / composition.denominator;
        const point = (turn: number, radius = 58) => `${72 + radius * Math.sin(turn * Math.PI * 2)} ${72 - radius * Math.cos(turn * Math.PI * 2)}`;
        const path = `M${point(start)} A58 58 0 0 1 ${point(start + portion / 2)} A58 58 0 0 1 ${point(start + portion)}`;
        const trim = portion < 1 ? Math.min(5 / (2 * Math.PI * 58), portion / 4) : 0;
        const visiblePath = `M${point(start + trim)} A58 58 0 0 1 ${point(start + portion / 2)} A58 58 0 0 1 ${point(start + portion - trim)}`;
        const wedge = `M72 72 L${point(start, 80)} A80 80 0 0 1 ${point(start + portion / 2, 80)} A80 80 0 0 1 ${point(start + portion, 80)} Z`;
        const angle = (start + portion / 2) * Math.PI * 2;
        const lift = portion < 1 ? 5 : 0;
        return <g style={{"--segment-x":`${Math.sin(angle)*lift}px`,"--segment-y":`${-Math.cos(angle)*lift}px`,"--segment-color":palette[index]} as CSSProperties} key={category.id} onMouseEnter={()=>setHovered(category.id)} onFocus={()=>setHovered(category.id)} className="atlas-disease-segment" data-active={hovered===category.id} role="button" tabIndex={0} aria-label={`${category.label}: ${category.count} report entries (${percent(category.count)}). View reports`} onClick={()=>onReport(category.record_ids)} onKeyDown={event=>{if(event.key==="Enter" || event.key===" "){event.preventDefault();onReport(category.record_ids);}}}>
            <defs><clipPath id={`${clipId}-${index}`}><path d={wedge} /></clipPath></defs>
            <path className="atlas-disease-hit" d={path} />
            <path className="atlas-disease-arc" d={visiblePath} stroke={palette[index]} clipPath={portion<1?`url(#${clipId}-${index})`:undefined} />
          </g>;
      })}
      <text x="72" y="72" textAnchor="middle">{composition.denominator}<tspan x="72" dy="19">report entries</tspan></text>
    </svg></Tooltip.Trigger>
    {active && <Tooltip.Portal><Tooltip.Content className="atlas-figure-infocard atlas-disease-infocard" side="top" sideOffset={12} collisionPadding={12}>
      <strong>{active.label}</strong>
      <div className="atlas-disease-info-value"><b>{active.count.toLocaleString("en-GB")}</b><span>report entries</span><b>{percent(active.count)}</b></div>
      <span className="atlas-figure-info-meta">Of {composition.denominator.toLocaleString("en-GB")} selected entries · reporting attention</span>
      {active.id==="other" && <span className="atlas-figure-info-meta">{categories.length-5} additional subjects</span>}
      <span className="atlas-figure-info-meta">Click to view reports</span>
      <Tooltip.Arrow className="atlas-figure-info-arrow" />
    </Tooltip.Content></Tooltip.Portal>}
  </Tooltip.Root></Tooltip.Provider></div>;
}
