import { sourceLogos } from "@/lib/atlas-identities";
import { DailyWatchCard } from "./atlas-daily";
import { dailyTitle, reportChronology, reportPublicationMonth, type DailyDocument, type DailySelection, type DailyState, type DailyWatch } from "@/lib/atlas-daily";
import * as Tooltip from "@radix-ui/react-tooltip";
import { memo, useMemo, useLayoutEffect, useId, useState, useContext, useCallback, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { AnimatePresence, animate, motion as m, useMotionValue, useTransform, useReducedMotion } from "motion/react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Expand, ChevronDown, ChevronLeft, ChevronRight, ChevronsDown, Newspaper, Radar, Activity, ChartPie, Building2 } from "lucide-react";
import { useAtlas, useAtlasPanelState, AtlasWorkspaceContext } from "./atlas-context";
import { useElementSize } from "./use-element-size";
import { ReportCountryFlags } from "./atlas-location-badges";
import { formatDate, type AtlasRecord } from "@/lib/atlas";
import { attentionSelection } from "@/lib/atlas-attention";

export const AtlasTrends = memo(function AtlasTrends({ networkOverview, rows, recordIds, window, onReport, onBrowseReports, daily, dailyDocuments = [], dailyState, dailyExcluded, onDailyReport, onWatchReports, onPeriod }: { networkOverview: ReactNode; rows: AtlasRecord[]; recordIds: Set<string>; window: [string, string]; onReport: (ids: string[], expand?: boolean) => void; onBrowseReports: () => void; daily?: DailySelection; dailyDocuments?: DailyDocument[]; dailyState?: DailyState; dailyExcluded?: boolean; onDailyReport: (id: string) => void; onWatchReports: (item: DailyWatch) => void; onPeriod: (month: string) => void }) {
  const { atlasDocuments, englishTitle, sourceName, reportOrganizations, selectedResearch } = useAtlas();
  const fullscreen = useContext(AtlasWorkspaceContext);
  const [attentionDays, setAttentionDays] = useAtlasPanelState<7 | 30>("trends.attention-period", 7);
  const attention = useMemo(() => {
    const selection = attentionSelection(rows, window, attentionDays);
    return { ...selection, composition: selectedResearch(selection.ids).disease_composition };
  }, [rows, window, attentionDays, selectedResearch]);
  const attentionDates = `${formatDate(attention.from)} to ${formatDate(attention.until)}`;
  const { ref: latestBody, size: latestSize } = useElementSize<HTMLDivElement>();
  const latestRowHeight = 84;
  const latestCount = latestSize ? Math.max(1, Math.floor((latestSize.height - latestRowHeight) / latestRowHeight)) : fullscreen ? 1 : 7;
  const latestFadeHeight = 1.5 * (latestSize ? latestSize.height / (latestCount + 1) : latestRowHeight);
  const dailyEvents = useMemo(() => daily?.watch_items ?? [], [daily]);
  const { ref: trends, size: trendsSize } = useElementSize<HTMLDivElement>();
  const [watchOpen, setWatchOpen] = useState(false);
  const watchExpanded = watchOpen && (fullscreen || (trendsSize?.width ?? 0) > 620);
  const watchList = useRef<HTMLDivElement>(null);
  const watchEntrance = useRef<HTMLButtonElement>(null);
  const watchExit = useRef<HTMLButtonElement>(null);
  const watchTransition = useRef<ViewTransition | null>(null);
  const [watchCount, setWatchCount] = useState(3);
  const [watchHasMore, setWatchHasMore] = useState(false);
  const watchEnd = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setWatchHasMore(!entry.isIntersecting), {
      root: element.parentElement,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => {
    watchTransition.current?.skipTransition();
    delete document.documentElement.dataset.atlasWatchTransition;
  }, []);
  function changeWatch(value: boolean) {
    const update = () => {
      flushSync(() => setWatchOpen(value));
      (value ? watchExit : watchEntrance).current?.focus({ preventScroll: true });
    };
    watchTransition.current?.skipTransition();
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
    document.documentElement.dataset.atlasWatchTransition = value ? "expand" : "collapse";
    const transition = document.startViewTransition(update);
    watchTransition.current = transition;
    const finish = () => {
      if (watchTransition.current !== transition) return;
      delete document.documentElement.dataset.atlasWatchTransition;
      watchTransition.current = null;
    };
    void transition.finished.then(finish, finish);
  }
  const data = useMemo(() => {
    const groups = new Map<string, AtlasRecord[]>();
    for (const row of rows) {
      const group = groups.get(row.document_id) ?? [];
      group.push(row); groups.set(row.document_id, group);
    }
    const publications = reportChronology([...groups.values()], dailyDocuments, id => atlasDocuments.get(id)!);
    const view = selectedResearch(recordIds);
    const counts = new Map<string, number>();
    for (const entry of publications) {
      const month = reportPublicationMonth(entry);
      counts.set(month, (counts.get(month) ?? 0) + 1);
    }
    const months = [];
    const cursor = new Date(`${window[0].slice(0, 7)}-01T00:00:00Z`);
    while (cursor.toISOString().slice(0, 7) <= window[1].slice(0, 7)) {
      const month = cursor.toISOString().slice(0, 7);
      months.push({ month, count: counts.get(month) ?? 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return { latest: publications, months, measured: view.numeric_coverage.records_with_measures, documents: publications.length };
  }, [rows, recordIds, atlasDocuments, window, selectedResearch, dailyDocuments]);
  const { latest } = data;
  function latestEntry(entry: (typeof latest)[number], index: number) {
    const dailyDocument = entry.dailyVersions[0];
    const document = entry.records.length ? atlasDocuments.get(entry.id)! : dailyDocument;
    const source = entry.records[0]?.source ?? dailyDocument.channel_id ?? dailyDocument.source_id;
    const logo = entry.records.length ? reportOrganizations[source]?.logo : sourceLogos[dailyDocument.source_id];
    const title = entry.records.length ? englishTitle(document) : dailyTitle(dailyDocument);
    return <m.li layout="position" layoutDependency={latest} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} key={entry.id} data-report-id={entry.id} className={index === latestCount ? "atlas-latest-preview" : undefined} inert={index === latestCount}><button className="atlas-latest-entry" onClick={() => dailyDocument ? onDailyReport(dailyDocument.id) : onReport(entry.records.map(record => record.id), true)}>
      <span className="atlas-timeline-node institution-logo atlas-source-logo" aria-hidden>{logo ? <Image src={`/logos/atlas/${logo}`} alt="" width={32} height={32} unoptimized /> : <Building2 size={18} />}</span>
      <span className="atlas-latest-date">{document.publication && <time dateTime={document.publication}>{formatDate(document.publication, entry.records.length ? "UTC" : "Europe/Amsterdam")}</time>}<small>{entry.records.length ? sourceName(source) : dailyDocument.source_name}</small></span>
      <span><strong title={title}>{title}</strong></span><ArrowRight size={16} aria-hidden />
    </button></m.li>;
  }
  const coverage = rows.length ? data.measured / rows.length * 100 : 0;
  return <div ref={trends} className="atlas-trends atlas-briefing" data-watch-expanded={watchExpanded} onKeyDown={event => {
    if (watchExpanded && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); changeWatch(false); }
  }}>
    <div className="atlas-trend-overview">
      <section className="atlas-trend-activity" aria-labelledby="atlas-activity-title">
        <header><Activity size={17} aria-hidden /><h2 id="atlas-activity-title">Reporting activity</h2><strong>{data.documents}<small> reports</small></strong></header>
        <ReportingActivity windowKey={window.join(":")} months={data.months} onPeriod={onPeriod} />
      </section>
      {networkOverview}
      <section className="atlas-trend-coverage" aria-labelledby="atlas-coverage-title">
        <header><ChartPie size={17} aria-hidden /><h2 id="atlas-coverage-title">{attention.composition ? "Attention" : "Figure coverage"}</h2>
          {attention.composition && <span className="atlas-attention-period" role="group" aria-label="Reporting attention period">
            <button title={`Switch to ${attentionDays === 7 ? "Monthly (30 days)" : "Weekly (7 days)"}. Current publication dates: ${attentionDates}. Daily reports without topic classifications are excluded.`} onClick={() => setAttentionDays(days => days === 7 ? 30 : 7)}>{attentionDays === 7 ? "Weekly" : "Monthly"}</button>
          </span>}
        </header>
        {attention.composition ? <DiseaseRing composition={attention.composition} dates={attentionDates} onReport={onReport} /> : <>
        <svg viewBox="10 10 124 124" role="img" aria-label={`${data.measured} of ${rows.length} records have extracted figures`}>
          <circle cx="72" cy="72" r="58" className="atlas-coverage-track" />
          <circle cx="72" cy="72" r="58" pathLength="100" strokeDasharray={`${coverage} ${100 - coverage}`} transform="rotate(-90 72 72)" className="atlas-coverage-value" />
          <text x="72" y="72" textAnchor="middle">{data.measured}<tspan x="72" dy="19">of {rows.length} records</tspan></text>
        </svg></>}
      </section>
    </div>
    <div className="atlas-briefing-columns" style={{ "--latest-row-height": `${latestRowHeight}px`, "--briefing-fade-height": `${latestFadeHeight}px` } as CSSProperties}><section className="atlas-watch" aria-labelledby="atlas-watch-title">
      <header><Radar size={18} aria-hidden /><h2 id="atlas-watch-title">Outbreak watch</h2>{watchExpanded && <button ref={watchExit} className="atlas-watch-close" onClick={() => changeWatch(false)}><ArrowLeft size={15} aria-hidden />Back to Trends</button>}</header>
      <div className="atlas-briefing-body" data-fade={!watchExpanded && dailyEvents.length > 0}><ReportCountryFlags value={true}><div ref={watchList} className="atlas-watch-list" tabIndex={watchExpanded ? 0 : undefined} role={watchExpanded ? "region" : undefined} aria-label={watchExpanded ? "Outbreak watch cards" : undefined}>{dailyState?.loading && <p className="atlas-daily-notice" role="status">Checking daily reports…</p>}{dailyState?.error && <p className="atlas-daily-notice" role="status">{dailyState.error}</p>}{dailyState?.data && dailyExcluded && <p className="atlas-daily-notice">Daily reports have no reviewed disease, topic or relationship classifications for these filters.</p>}<div className="atlas-watch-cards" id="atlas-watch-cards"><AnimatePresence initial={false} mode="popLayout">{dailyEvents.map((item, index) => <m.div layout="position" layoutDependency={dailyEvents} initial={{ opacity: 0, y: 16, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: .97 }} key={item.id} data-mobile-hidden={index >= watchCount}><DailyWatchCard item={item} onReports={onWatchReports} /></m.div>)}</AnimatePresence></div>
        {dailyEvents.length > watchCount && <button className="atlas-briefing-link atlas-watch-more" aria-controls="atlas-watch-cards" onClick={() => setWatchCount(count => count + 3)}>Load more<ChevronDown size={16} aria-hidden /></button>}
        {!dailyEvents.length && !dailyState?.loading && !dailyState?.error && <p className="atlas-empty">No current watch selections match this reporting scope.</p>}<div ref={watchEnd} className="atlas-watch-end" aria-hidden /></div></ReportCountryFlags>
        {dailyEvents.length > 0 && !watchExpanded && <button ref={watchEntrance} className="atlas-briefing-link atlas-watch-all" aria-expanded={false} aria-controls="atlas-watch-cards" onClick={() => changeWatch(true)}>View all outbreaks<Expand size={15} aria-hidden /></button>}
        {watchExpanded && <button className="atlas-watch-next atlas-scroll-cue" data-more={watchHasMore} tabIndex={watchHasMore ? 0 : -1} aria-hidden={!watchHasMore} aria-label="More outbreaks below" title="More outbreaks below" aria-controls="atlas-watch-cards" onClick={() => watchList.current?.scrollBy({ top: watchList.current.clientHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><ChevronsDown size={18} aria-hidden /></button>}
      </div>
    </section>
    <section className="atlas-latest" aria-labelledby="atlas-latest-title">
      <header><Newspaper size={18} aria-hidden /><h2 id="atlas-latest-title">Latest reports</h2></header>
      <div ref={latestBody} className="atlas-briefing-body atlas-latest-body" data-fade={latest.length > latestCount}>
        <ol className="atlas-latest-list"><AnimatePresence initial={false} mode="popLayout">{latest.length ? latest.slice(0, latestCount + 1).map(latestEntry) : <li key="empty" className="atlas-empty">No dated reports match these filters.</li>}</AnimatePresence></ol>
        <button className="atlas-briefing-link atlas-latest-all" onClick={onBrowseReports}>View all reports<ArrowRight size={15} aria-hidden /></button>
      </div>
    </section></div>
  </div>;
});

function ReportingActivity({ months, onPeriod, windowKey }: { windowKey: string; months: { month: string; count: number }[]; onPeriod: (month: string) => void }) {
  const bars = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const chartId = useId();
  useLayoutEffect(() => {
    const element = bars.current;
    if (!element) return;
    let atEnd = true;
    const update = () => {
      const left = element.scrollLeft > 0;
      // Rounded scroll dimensions can differ from the reachable offset by one pixel.
      const right = element.scrollWidth - element.clientWidth - element.scrollLeft > 1;
      atEnd = !right;
      setEdges(current => current.left === left && current.right === right ? current : { left, right });
    };
    element.scrollLeft = element.scrollWidth;
    update();
    const observer = new ResizeObserver(() => {
      if (atEnd) element.scrollLeft = element.scrollWidth;
      update();
    });
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [windowKey]);
  const scroll = (direction: number) => {
    const element = bars.current;
    if (element) element.scrollBy({ left: direction * element.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };
  const peak = Math.max(1, ...months.map(month => month.count));
  return <div className="atlas-activity-chart">
    <div ref={bars} id={chartId} className="atlas-activity-bars" tabIndex={0} role="group" aria-label="Monthly reporting activity">
      {months.map(({ month, count }) => <m.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={month} disabled={!count} aria-label={`${month}: ${count} reports. View reports`} onClick={() => onPeriod(month)}>
        <span className="atlas-activity-track"><m.span initial={false} style={{ height: "calc(100% - 20px)", originY: 1 }} animate={{ transform: `scaleY(${count / peak})` }} /><b>{count}</b></span>
        <span>{new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${month}-01`))}<small>{month.slice(0, 4)}</small></span>
      </m.button>)}
    </div>
    <span className="atlas-activity-edge" data-side="left" hidden={!edges.left}><button aria-label="Scroll to earlier months" aria-controls={chartId} onClick={() => scroll(-1)}><ChevronLeft size={16} aria-hidden /></button></span>
    <span className="atlas-activity-edge" data-side="right" hidden={!edges.right}><button aria-label="Scroll to later months" aria-controls={chartId} onClick={() => scroll(1)}><ChevronRight size={16} aria-hidden /></button></span>
  </div>;
}

function DiseaseRing({ composition, dates, onReport }: { composition: import("@/lib/atlas-contract").AtlasDiseaseComposition; dates: string; onReport: (ids: string[]) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const categories = composition.categories.filter(c => c.count > 0).sort((a,b) => b.count-a.count);
  const palette = Array.from({length:6}, (_, i)=>`var(--attention-${i+1})`);
  const slices = categories.slice(0,5);
  if (categories.length > 5) slices.push({ id: "other", label: "Other report subjects", kind: "other", count: categories.slice(5).reduce((sum,c)=>sum+c.count,0), proportion: null, record_ids: categories.slice(5).flatMap(c=>c.record_ids) });
  const active = slices.find(slice=>slice.id===hovered);
  const percent = (count: number) => new Intl.NumberFormat("en-GB", {style:"percent",maximumFractionDigits:1}).format(count/composition.denominator);
  return <div className="atlas-disease-ring" data-highlighted={!!active}><Tooltip.Provider delayDuration={120}><Tooltip.Root onOpenChange={open=>{if(!open)setHovered(null);}}>
    <Tooltip.Trigger asChild><svg viewBox="10 10 124 124" role="group" aria-label={`Reporting attention by subject across ${composition.denominator} report entries published ${dates}; not disease incidence`}>
      <circle cx="72" cy="72" r="58" className="atlas-coverage-track" />
      <AnimatePresence initial={false}>{slices.map((category, index) => {
        const portion = category.count / composition.denominator;
        const start = slices.slice(0, index).reduce((sum, slice) => sum + slice.count, 0) / composition.denominator;
        const angle = (start + portion / 2) * Math.PI * 2;
        const lift = portion < 1 ? 5 : 0;
        return <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{"--segment-x":`${Math.sin(angle)*lift}px`,"--segment-y":`${-Math.cos(angle)*lift}px`,"--segment-color":palette[index]} as CSSProperties} key={category.id} onMouseEnter={()=>setHovered(category.id)} onFocus={()=>setHovered(category.id)} className="atlas-disease-segment" data-active={hovered===category.id} role="button" tabIndex={0} aria-label={`${category.label}: ${category.count} report entries (${percent(category.count)}). View reports`} onClick={()=>onReport(category.record_ids)} onKeyDown={event=>{if(event.key==="Enter" || event.key===" "){event.preventDefault();onReport(category.record_ids);}}}>
            <RingArc start={start} portion={portion} color={palette[index]} />
          </m.g>;
      })}</AnimatePresence>
      <text x="72" y="72" textAnchor="middle">{composition.denominator}<tspan x="72" dy="19">report entries</tspan></text>
    </svg></Tooltip.Trigger>
    {active && <Tooltip.Portal><Tooltip.Content className="atlas-figure-infocard atlas-disease-infocard" side="top" sideOffset={12} collisionPadding={12}>
      <strong>{active.label}</strong>
      <div className="atlas-disease-info-value"><b>{active.count.toLocaleString("en-GB")}</b><span>report entries</span><b>{percent(active.count)}</b></div>
      <span className="atlas-figure-info-meta">Of {composition.denominator.toLocaleString("en-GB")} report entries · {dates}</span>
      {active.id==="other" && <span className="atlas-figure-info-meta">{categories.length-5} additional subjects</span>}
      <span className="atlas-figure-info-meta">Click to view reports</span>
      <Tooltip.Arrow className="atlas-figure-info-arrow" />
    </Tooltip.Content></Tooltip.Portal>}
  </Tooltip.Root></Tooltip.Provider></div>;
}

function RingArc({ start, portion, color }: { start: number; portion: number; color: string }) {
  const clip = useId();
  const from = useMotionValue(start), length = useMotionValue(portion);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    const transition = { duration: reducedMotion ? 0 : .45, ease: [.22, .8, .2, 1] as const };
    const controls = [animate(from, start, transition), animate(length, portion, transition)];
    return () => controls.forEach(control => control.stop());
  }, [from, length, start, portion, reducedMotion]);
  const geometry = useTransform(() => {
    const start = from.get(), portion = length.get();
    const point = (turn: number, radius = 58) => `${72 + radius * Math.sin(turn * Math.PI * 2)} ${72 - radius * Math.cos(turn * Math.PI * 2)}`;
    const trim = portion < 1 ? Math.min(5 / (2 * Math.PI * 58), portion / 4) : 0;
    return {
      hit: `M${point(start)} A58 58 0 0 1 ${point(start + portion / 2)} A58 58 0 0 1 ${point(start + portion)}`,
      arc: `M${point(start + trim)} A58 58 0 0 1 ${point(start + portion / 2)} A58 58 0 0 1 ${point(start + portion - trim)}`,
      wedge: `M72 72 L${point(start, 80)} A80 80 0 0 1 ${point(start + portion / 2, 80)} A80 80 0 0 1 ${point(start + portion, 80)} Z`,
    };
  });
  const hit = useTransform(geometry, value => value.hit);
  const arc = useTransform(geometry, value => value.arc);
  const wedge = useTransform(geometry, value => value.wedge);
  return <>
    <defs><clipPath id={clip}><m.path d={wedge} /></clipPath></defs>
    <m.path className="atlas-disease-hit" d={hit} />
    <m.path className="atlas-disease-arc" d={arc} stroke={color} clipPath={portion < 1 ? `url(#${clip})` : undefined} />
  </>;
}
