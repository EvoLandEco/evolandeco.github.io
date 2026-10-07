import { sourceLogos } from "@/lib/atlas-identities";
import { DailyWatchCard } from "./atlas-daily";
import { dailyTitle, reportChronology, type DailyDocument, type DailySelection, type DailyState, type DailyWatch } from "@/lib/atlas-daily";
import * as Tooltip from "@radix-ui/react-tooltip";
import { visibleMeasure, measureEvidenceRecords } from "@/lib/atlas-metrics";
import { memo, useMemo, useId, useState, useContext, useCallback, type CSSProperties } from "react";
import Image from "next/image";
import { ArrowRight, ChevronDown, ChevronsDown, Newspaper, Radar, Activity, ChartPie, Building2 } from "lucide-react";
import { useAtlas, AtlasWorkspaceContext } from "./atlas-context";
import { useElementSize } from "./use-element-size";
import { ReportCountryFlags } from "./atlas-location-badges";
import { formatDate, type AtlasRecord } from "@/lib/atlas";

export const AtlasTrends = memo(function AtlasTrends({ rows, window, onReport, onBrowseReports, daily, dailyDocuments = [], dailyState, dailyExcluded, onDailyReport, onWatchReports, onPeriod }: { rows: AtlasRecord[]; window: [string, string]; onReport: (ids: string[], expand?: boolean) => void; onBrowseReports: () => void; daily?: DailySelection; dailyDocuments?: DailyDocument[]; dailyState?: DailyState; dailyExcluded?: boolean; onDailyReport: (id: string) => void; onWatchReports: (item: DailyWatch) => void; onPeriod: (month: string) => void }) {
  const { atlasDocuments, englishTitle, sourceName, reportOrganizations, selectedResearch, metrics } = useAtlas();
  const fullscreen = useContext(AtlasWorkspaceContext);
  const { ref: latestBody, size: latestSize } = useElementSize<HTMLDivElement>();
  const latestRowHeight = 84;
  const latestCount = fullscreen ? Math.max(1, Math.floor(((latestSize?.height ?? 0) - latestRowHeight) / latestRowHeight)) : 7;
  const latestFadeHeight = fullscreen && latestSize ? latestSize.height / (latestCount + 1) : latestRowHeight;
  const dailyEvents = useMemo(() => daily?.watch_items ?? [], [daily]);
  const [watchCount, setWatchCount] = useState(3);
  const [watchHasMore, setWatchHasMore] = useState(false);
  const watchEnd = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setWatchHasMore(!entry.isIntersecting), {
      root: element.parentElement,
      rootMargin: `0px 0px -${latestFadeHeight}px 0px`,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [latestFadeHeight]);
  const featuredDaily = useMemo(() => new Set(dailyEvents.flatMap(item => item.document_ids)), [dailyEvents]);
  const data = useMemo(() => {
    const ids = new Set(rows.map(row => row.id));
    const groups = new Map<string, AtlasRecord[]>();
    for (const row of rows) {
      const group = groups.get(row.document_id) ?? [];
      group.push(row); groups.set(row.document_id, group);
    }
    const publications = reportChronology([...groups.values()], dailyDocuments, id => atlasDocuments.get(id)!);
    const latest = publications.filter(entry => !entry.dailyVersions.some(doc => featuredDaily.has(doc.id)));
    const view = selectedResearch(ids);
    const eligible = new Set(view.panels.flatMap(panel => panel.measure_ids));
    const measured = new Set(metrics.measures.filter(measure => eligible.has(measure.measure_id) && visibleMeasure(measure, ids) && !measure.superseded).flatMap(measureEvidenceRecords));
    const months = [];
    const cursor = new Date(`${window[0].slice(0, 7)}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= window[1].slice(0, 7)) {
      const month = cursor.toISOString().slice(0, 7);
      const count = publications.filter(entry => entry.publication.startsWith(month)).length;
      months.push({ month, count });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return { latest, months, composition: view.disease_composition, measured: view.numeric_coverage?.records_with_measures ?? measured.size, documents: publications.length };
  }, [rows, atlasDocuments, window, selectedResearch, metrics, featuredDaily, dailyDocuments]);
  const { latest } = data;
  function latestEntry(entry: (typeof latest)[number], index: number) {
    const dailyDocument = entry.dailyVersions[0];
    const document = entry.records.length ? atlasDocuments.get(entry.id)! : dailyDocument;
    const source = entry.records[0]?.source ?? dailyDocument.channel_id ?? dailyDocument.source_id;
    const logo = entry.records.length ? reportOrganizations[source]?.logo : sourceLogos[dailyDocument.source_id];
    const title = entry.records.length ? englishTitle(document) : dailyTitle(dailyDocument);
    return <li key={entry.id} className={index === latestCount ? "atlas-latest-preview" : undefined} inert={index === latestCount}><button className="atlas-latest-entry" onClick={() => dailyDocument ? onDailyReport(dailyDocument.id) : onReport(entry.records.map(record => record.id), true)}>
      <span className="atlas-timeline-node institution-logo atlas-source-logo" aria-hidden>{logo ? <Image src={`/logos/atlas/${logo}`} alt="" width={32} height={32} unoptimized /> : <Building2 size={18} />}</span>
      <span className="atlas-latest-date">{document.publication && <time dateTime={document.publication}>{formatDate(document.publication)}</time>}<small>{entry.records.length ? sourceName(source) : dailyDocument.source_name}</small></span>
      <span><strong title={title}>{title}</strong></span><ArrowRight size={16} aria-hidden />
    </button></li>;
  }
  const peak = Math.max(1, ...data.months.map(month => month.count));
  const coverage = rows.length ? data.measured / rows.length * 100 : 0;
  return <div className="atlas-trends atlas-briefing">
    <div className="atlas-trend-overview">
      <section className="atlas-trend-activity" aria-labelledby="atlas-activity-title">
        <header><Activity size={17} aria-hidden /><h2 id="atlas-activity-title">Reporting activity</h2><strong>{data.documents}<small> reports</small></strong></header>
        <div className="atlas-activity-bars">{data.months.map(({ month, count }) => <button key={month} disabled={!count} aria-label={`${month}: ${count} reports. View reports`} onClick={() => onPeriod(month)}>
          <span className="atlas-activity-track"><span style={{ height: `calc((100% - 20px) * ${count / peak})` }} /><b>{count}</b></span>
          <span>{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01`))}<small>{month.slice(0, 4)}</small></span>
        </button>)}</div>
      </section>
      <section className="atlas-trend-coverage" aria-labelledby="atlas-coverage-title">
        <header><ChartPie size={17} aria-hidden /><h2 id="atlas-coverage-title">{data.composition ? "Reporting attention" : "Figure coverage"}</h2>{dailyState?.data && <span className="atlas-daily-attention-scope" title="Weekly reviewed reports" aria-label="Weekly reviewed reports">Weekly</span>}</header>
        {data.composition ? <DiseaseRing composition={data.composition} onReport={onReport} /> : <>
        <svg viewBox="10 10 124 124" role="img" aria-label={`${data.measured} of ${rows.length} records have extracted figures`}>
          <circle cx="72" cy="72" r="58" className="atlas-coverage-track" />
          <circle cx="72" cy="72" r="58" pathLength="100" strokeDasharray={`${coverage} ${100 - coverage}`} transform="rotate(-90 72 72)" className="atlas-coverage-value" />
          <text x="72" y="72" textAnchor="middle">{data.measured}<tspan x="72" dy="19">of {rows.length} records</tspan></text>
        </svg></>}
      </section>
    </div>
    <div className="atlas-briefing-columns" style={{ "--latest-row-height": `${latestRowHeight}px`, "--briefing-fade-height": `${latestFadeHeight}px` } as CSSProperties}><section className="atlas-watch" aria-labelledby="atlas-watch-title">
      <header><Radar size={18} aria-hidden /><h2 id="atlas-watch-title">Outbreak watch</h2></header>
      <div className="atlas-briefing-body" data-fade={dailyEvents.length > 0}><ReportCountryFlags value={true}><div className="atlas-watch-list">{dailyState?.loading && <p className="atlas-daily-notice" role="status">Checking daily reports…</p>}{dailyState?.error && <p className="atlas-daily-notice" role="status">{dailyState.error}</p>}{dailyState?.data && dailyExcluded && <p className="atlas-daily-notice">Daily reports have no reviewed disease, topic or relationship classifications for these filters.</p>}{daily && dailyEvents.length > 0 ? <>
        <div className="atlas-watch-cards" id="atlas-watch-cards">{dailyEvents.map((item, index) => <div key={item.id} data-mobile-hidden={index >= watchCount}><DailyWatchCard item={item} onReports={onWatchReports} /></div>)}</div>
        {dailyEvents.length > watchCount && <button className="atlas-briefing-link atlas-watch-more" aria-controls="atlas-watch-cards" onClick={() => setWatchCount(count => count + 3)}>Load more<ChevronDown size={16} aria-hidden /></button>}
      </> : !dailyState?.loading && !dailyState?.error && <p className="atlas-empty">No current watch selections match this reporting scope.</p>}<div ref={watchEnd} className="atlas-watch-end" aria-hidden /></div></ReportCountryFlags>
        {dailyEvents.length > 0 && watchHasMore && <span className="atlas-watch-scroll" aria-hidden><span>Scroll for more<ChevronsDown size={16} /></span></span>}
      </div>
    </section>
    <section className="atlas-latest" aria-labelledby="atlas-latest-title">
      <header><Newspaper size={18} aria-hidden /><h2 id="atlas-latest-title">Latest reports</h2></header>
      <div ref={latestBody} className="atlas-briefing-body atlas-latest-body" data-fade={latest.length > latestCount}>
        <ol className="atlas-latest-list">{latest.length ? latest.slice(0, latestCount + 1).map(latestEntry) : <li className="atlas-empty">No additional dated reports match these filters.</li>}</ol>
        <button className="atlas-briefing-link atlas-latest-all" onClick={onBrowseReports}>View all reports<ArrowRight size={15} aria-hidden /></button>
      </div>
    </section></div>
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
