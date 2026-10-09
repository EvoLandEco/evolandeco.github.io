"use client";
import { AnimatePresence, motion as m } from "motion/react";
import { SourceQuotation } from "./atlas-source-text";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, ArrowRight, ChevronDown, ChevronsDown, ChevronsLeft, ChevronsRight, ExternalLink, FileText, Network, Grid2X2, Rows3, BookOpen, Check, Activity, CalendarDays, Microscope, Info, TriangleAlert, UserRound, PawPrint, Leaf, Wheat, CircleHelp, MapPin } from "lucide-react";
import { createPortal } from "react-dom";
import { ReportPagination } from "./atlas-pagination";
import { revealAtlasEntries } from "@/lib/atlas-detail-scroll";
import { useAtlas, useAtlasPanelState } from "./atlas-context";
import { useAtlasContentMotion } from "./use-atlas-content-motion";
import { useElementSize } from "./use-element-size";
import { AtlasEntryFilters } from "./atlas-entry-filters";
import { AtlasScope } from "./atlas-scope";
import { AtlasDetailStatus, useAtlasDetails } from "./atlas-detail";
import { AtlasDisclosure } from "./atlas-disclosure";
import { AtlasHealthPanels } from "./atlas-one-health-panels";
import { AtlasSelect, type AtlasSelectItem } from "./atlas-select";
import { LocationBadges } from "./atlas-location-badges";
import { formatDate, type AtlasRecord } from "@/lib/atlas";
import { metricValue } from "@/lib/atlas-metrics";
import { healthOverviewEvidence, compareHealthEvidence, healthEntryIndex, healthViews, matchesHealthEntry, type HealthEntry } from "@/lib/atlas-health-entries";
import { healthLayout } from "@/lib/atlas-health-layout";
import { fitChainMap, chainLandDots } from "@/lib/atlas-chain-map";
import type { AtlasOneHealthNode as Node, AtlasOneHealthDomain as Domain, AtlasSelectedOneHealth } from "@/lib/atlas-contract";
import type { AtlasDetailRef } from "@/lib/atlas-browser";

type HealthMode = "network" | "evidence" | "overview" | "timeline" | "sampling" | "environment";
const panelModes = [...healthViews,{value:"overview" as const,label:"Overview"}];
type Relation = AtlasSelectedOneHealth["relations"][number];
const domains: { id: Domain; label: string }[] = [{ id: "human", label: "People" }, { id: "animal", label: "Animals" }, { id: "environment", label: "Environment" }, { id: "food", label: "Food & commodities" }, { id: "unknown", label: "Unknown" }];
const findings: Record<Node["finding"], string> = { infection_reported: "Infection reported", illness_reported: "Illness reported", agent_detected: "Detected", agent_not_detected: "Not detected in sampled material", exposure_reported: "Exposure reported", movement_reported: "Movement reported", context: "Context reported", unresolved: "Under investigation" };
const relationLabels: Record<Relation["kind"], string> = { exposure: "Exposure", genomic_association: "Genomic association", environmental_association: "Environmental association", commodity_movement: "Commodity movement", vector_involvement: "Vector involvement", cross_species_transmission: "Cross-species transmission" };
const words = (value: string) => value.replaceAll("_", " ");
const dateLabel = (node: Node | Relation) => node.observation_date.value ? formatDate(node.observation_date.value) : node.period_start.value && node.period_end.value ? `${formatDate(node.period_start.value)} – ${formatDate(node.period_end.value)}` : "Observation date unknown";

export const AtlasOneHealth = memo(function AtlasOneHealth({ rows, onReport, footerTarget, mergedTimeline = false, initialReport = "" }: { mergedTimeline?: boolean; initialReport?: string; footerTarget: HTMLElement | null; rows: AtlasRecord[]; onReport: (ids: string[], expand?: boolean) => void }) {
  const { bundle, selectedOneHealth, atlasDocuments, englishTitle } = useAtlas();
  const content = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useAtlasPanelState<HealthMode>("health.mode", "network");
  const [report, setReport] = useAtlasPanelState("health.report", initialReport);
  const [selection, setSelection] = useAtlasPanelState("health.selection", "");
  const [hover, setHover] = useState({report:"",id:""});
  const main=useRef<HTMLDivElement>(null);
  const figure=useRef<HTMLDivElement>(null);
  const networkId=useId();
  const [networkEdges,setNetworkEdges]=useState({down:false,left:false,right:false});
  const nodeEntries=useRef<HTMLDivElement>(null);
  const relationEntries=useRef<HTMLDivElement>(null);
  const [entryFilters,setEntryFilters]=useAtlasPanelState<string[]>("health.filters", []);
  useAtlasContentMotion(content, mode);
  const [overviewTools,setOverviewTools]=useState<HTMLDivElement|null>(null);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => { detail.current?.scrollTo({ top: 0 }); }, [selection, report]);
  const ids = useMemo(() => new Set(rows.map(row => row.id)), [rows]);
  const view = useMemo(() => selectedOneHealth(ids), [ids, selectedOneHealth]);
  const entryIndex=useMemo(()=>{
    const index = view ? healthEntryIndex(view) : new Map<string,HealthEntry>();
    if (mergedTimeline) for (const entry of index.values()) entry.counts.timeline += entry.counts.environment;
    return index;
  },[view,mergedTimeline]);
  const reports = useMemo(() => {
    const records = new Map(bundle.records.map(record => [record.id, record]));
    const topics = new Map(bundle.topics.map(topic => [topic.id, topic.label]));
    return [...entryIndex].map(([id,entry])=>{
      const record=records.get(id)!;
      return {id,entry,topic:topics.get(record.topic_id)!,document:atlasDocuments.get(record.document_id)!};
    });
  },[entryIndex,atlasDocuments,bundle]);
  const matching=useMemo(()=>reports.filter(r=>matchesHealthEntry(r.entry,entryFilters)),[reports,entryFilters]);
  const current = matching.find(r => r.id === report) ?? matching[0];
  const overviewRows=useMemo(()=>{
    if (!entryFilters.length) return rows;
    const matchingIds = new Set(matching.map(entry=>entry.id));
    return rows.filter(row=>matchingIds.has(row.id));
  },[entryFilters,rows,matching]);
  const selectedIds=current?.entry.nodeIds;
  const { relations, diagramNodes, items, surveillance } = useMemo(()=>{
    const nodes=view?.nodes.filter(n=>selectedIds?.has(n.id)) ?? [];
    const undated=view?.undated_nodes.filter(n=>selectedIds?.has(n.id)) ?? [];
    return { items:[...nodes,...undated],
      relations:view?.relations.filter(r=>selectedIds?.has(r.from_node_id)&&selectedIds.has(r.to_node_id)) ?? [],
      diagramNodes:nodes.filter(n=>n.scope!=="background"), surveillance:nodes.filter(n=>n.scope==="surveillance") };
  },[view,selectedIds]);
  useEffect(()=>{
    const element=figure.current;
    if (!element || mode!=="network") return;
    const update=()=>{
      const down=Math.ceil(element.scrollTop)<element.scrollHeight-element.clientHeight;
      const left=element.scrollLeft>0;
      const right=Math.ceil(element.scrollLeft)<element.scrollWidth-element.clientWidth;
      setNetworkEdges(current=>current.down===down && current.left===left && current.right===right ? current : {down,left,right});
    };
    const observer=new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll",update,{passive:true});
    update();
    return ()=>{observer.disconnect();element.removeEventListener("scroll",update);};
  },[diagramNodes,mode]);
  function scrollNetwork(direction:"down"|"left"|"right") {
    const element=figure.current;
    if (element) element.scrollBy({top:direction==="down" ? element.clientHeight : 0,left:direction==="down" ? 0 : element.clientWidth*(direction==="left" ? -1 : 1),behavior:matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  }
  const reportItems=useMemo<AtlasSelectItem[]>(()=>{
    const views=healthViews.filter(v=>(!mergedTimeline || v.value!=="environment"));
    const labels = new Map<string, number>();
    for (const r of reports) { const label = `${r.topic} · ${englishTitle(r.document)}`; labels.set(label, (labels.get(label) ?? 0) + 1); }
    return matching.map(r => ({ value:r.id, label:`${r.topic} · ${englishTitle(r.document)}`, title:r.topic,
      badges:[{kind:"period",label:formatDate(r.document.publication)},...(labels.get(`${r.topic} · ${englishTitle(r.document)}`)! > 1 ? [{kind:"period" as const,label:`Captured ${formatDate(r.document.capture)}`}] : []),...views.map(v=>({kind:v.value,label:`${v.label} ${r.entry.counts[v.value]}`,empty:r.entry.counts[v.value]===0}))] }));
  },[reports,matching,mergedTimeline,englishTitle]);
  const selectReport=useCallback((value:string)=>{setReport(value);setSelection("");},[setReport,setSelection]);
  const modeItems=useMemo<AtlasSelectItem[]>(()=>panelModes.filter(m => !mergedTimeline || m.value !== "environment").map(m=>({value:m.value,label:m.label,title:m.label,badges:m.value==='overview' ? [{kind:'count',label:`${overviewRows.length} entries`}] : [
    {kind:m.value,label:current ? `${current.entry.counts[m.value]} in this entry` : 'No entry selected',empty:!current?.entry.counts[m.value]},
    {kind:'count',label:`${matching.filter(r=>r.entry.counts[m.value]>0).length} entries available`},
  ]})),[mergedTimeline,overviewRows.length,current,matching]);
  const highlighted=hover.report===current?.id ? hover.id : "";
  const highlight=(id:string,fromFigure=false)=>{
    setHover({report:current?.id ?? "",id});
    if(fromFigure) revealAtlasEntries(relations.some(r=>r.id===id)?relationEntries.current:nodeEntries.current,[id]);
    else revealAtlasEntries(figure.current,[id]);
  };
  const select=(id:string,fromFigure=false)=>{
    setSelection(id);
    highlight(id,fromFigure);
    if(!fromFigure) revealAtlasEntries(main.current,[id]);
  };
  const clearHighlight=()=>setHover({report:"",id:""});
  if (!view) return <p className="atlas-empty">This dataset does not contain One Health reviews.</p>;
  const ModeIcon = { network: Network, evidence: Grid2X2, overview: Rows3, timeline: CalendarDays, sampling: Microscope, environment: Leaf }[mode];
  const selected = mode === "evidence" ? relations.find(r => r.id === selection) ?? relations[0] : items.find(n => n.id === selection) ?? relations.find(r => r.id === selection) ?? items[0];
  const review = view.reviews.find(r => r.record_id === current?.id);
  const reviewHelp = review && current && <AtlasScope label="Review scope" title={englishTitle(current.document)}><p>{words(review.outcome)} review</p><p>{review.scope}</p><p>{review.reason}</p>{!relations.some(r=>r.kind==="cross_species_transmission") && <p>No supported cross-species transmission relationship in this selection.</p>}<ul>{review.pending_items.map(item=><li key={item}>{item}</li>)}</ul></AtlasScope>;
  return <section className="atlas-one-health" aria-label="One Health evidence">
    <h2 className="sr-only">One Health evidence</h2>
    <div className="atlas-oh-tools atlas-entry-tools atlas-panel-tools"><div className="atlas-oh-view-select"><AtlasSelect label="One Health view" summaryLabel={<span className="atlas-oh-mode-label"><ModeIcon size={14} aria-hidden /><span>{modeItems.find(item => item.value === mode)?.label}</span></span>} value={mode} items={modeItems} onChange={value=>setMode(value as HealthMode)} /></div>
    {mode !== "overview" && current && <AtlasSelect label="One Health report" searchable value={current.id} onChange={selectReport} items={reportItems} />}
    {mode === "overview" && <div ref={setOverviewTools} className="atlas-oh-overview-tools" />}
    <AtlasEntryFilters label="Filter One Health entries" value={entryFilters} onChange={setEntryFilters} count={matching.length} total={reports.length} groups={[
      { label: "Content available", match: "any", items: healthViews.filter(v => !mergedTimeline || v.value !== "environment").map(v => ({ value: `view:${v.value}`, label: v.label })) },
      { label: "Includes domain", match: "any", items: domains.map(d => ({ value: `domain:${d.id}`, label: d.label })) },
      { label: "Features", match: "all", items: [
        { value: "feature:dated", label: "Dated panel evidence" }, { value: "feature:fraction", label: "Reviewed sample fraction" },
        { value: "feature:negative", label: "Negative findings" }, { value: "feature:hypothesis", label: "Source hypothesis" },
      ] },
    ]} /></div>
    {footerTarget && createPortal(<div className="atlas-view-about"><AtlasScope buttonLabel="About One Health" label="Figure methods & references" title="One Health evidence"><HealthMethods /></AtlasScope></div>, footerTarget)}
    <div ref={content} className="atlas-oh-content">
    {mode === "overview" ? <HealthOverview toolsTarget={overviewTools} footerTarget={footerTarget} rows={overviewRows} view={view} onOpen={(id,nodeId)=>{setReport(id);setSelection(nodeId ?? "");setMode("network");}} onReport={onReport} /> : current && (mode === "timeline" || mode === "sampling" || mode === "environment") ? <AtlasHealthPanels mergedTimeline={mergedTimeline} key={`${mode}:${current.id}`} mode={mode} view={view} reportId={current.id} nodeIds={selectedIds ?? new Set<string>()} onReport={onReport} /> : current ? <>
      <div className="atlas-oh-layout" data-view={mode}>
        <div ref={main} className="atlas-oh-main">
          <div className="atlas-oh-figure">
            {mode === "evidence" ? <HealthEvidence relations={relations} selected={selected?.id} onSelect={setSelection} reviewHelp={reviewHelp} /> : <div className="atlas-oh-network-frame"><div ref={figure} id={networkId} className="atlas-oh-network" role="region" aria-label="One Health network diagram" tabIndex={0}><HealthLanes nodes={diagramNodes} relations={relations} selected={selected?.id} highlighted={highlighted} onHover={id=>highlight(id,true)} onLeave={clearHighlight} onSelect={id=>select(id,true)} /></div>
              {([{direction:"down",label:"More network observations below",Icon:ChevronsDown},{direction:"left",label:"Scroll network left",Icon:ChevronsLeft},{direction:"right",label:"Scroll network right",Icon:ChevronsRight}] as const).map(({direction,label,Icon})=><button key={direction} className="atlas-scroll-cue" data-direction={direction} data-more={networkEdges[direction]} tabIndex={networkEdges[direction] ? 0 : -1} aria-hidden={!networkEdges[direction]} aria-label={label} title={label} aria-controls={networkId} onClick={()=>scrollNetwork(direction)}><Icon size={18} aria-hidden /></button>)}
            </div>}
            {mode === "network" && <div className="atlas-oh-key">{[...new Set(relations.filter(r=>r.basis!=="source_hypothesis").map(r=>r.kind))].map(kind=><span key={kind}><i data-kind={kind==="genomic_association"?"genomic":undefined} />{relationLabels[kind]}</span>)}{relations.some(r=>r.basis==="source_hypothesis") && <span><i data-kind="hypothesis" />Source hypothesis</span>}{relations.some(r=>r.directed) && <span>→ Source-supported direction</span>}</div>}
          </div>
          {mode === "network" && <><section className="atlas-oh-observations" aria-label="Observation list">
            <div className="atlas-oh-list-title"><h3><FileText size={14} aria-hidden />Observation list</h3>{reviewHelp}</div>
            <div className="atlas-oh-entry-panels">
              <section aria-label="Observation nodes"><div ref={nodeEntries} className="atlas-oh-node-entries"><HealthObservationList nodes={items} networkNodes={diagramNodes} selected={selected?.id} highlighted={highlighted} onHover={highlight} onLeave={clearHighlight} onSelect={select} /><SurveillancePanels nodes={surveillance} /></div></section>
              <section aria-label="Observation connections">
                <div ref={relationEntries} className="atlas-oh-relations" role="group" aria-label="One Health relationships">{relations.length ? relations.map(r=>{
                  const from=diagramNodes.findIndex(n=>n.id===r.from_node_id), to=diagramNodes.findIndex(n=>n.id===r.to_node_id);
                  return <button className="atlas-oh-entry" key={r.id} data-entry-id={r.id} data-highlighted={highlighted===r.id} data-kind={r.kind} data-basis={r.basis} aria-pressed={selected?.id===r.id} onPointerEnter={()=>highlight(r.id)} onPointerLeave={clearHighlight} onFocus={()=>highlight(r.id)} onBlur={clearHighlight} onClick={()=>select(r.id)}>
                    <span className="atlas-oh-list-marker atlas-oh-connection-marker"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M10 21C18 21 14 11 22 11" /><circle cx="7" cy="21" r="3" /><circle cx="25" cy="11" r="3" /></svg>{from>=0 && to>=0 && <span>{from+1} {r.directed ? '→' : '—'} {to+1}</span>}</span>
                    <span className="atlas-oh-list-content"><strong title={r.label}>{r.label}</strong><span className="atlas-oh-list-facts"><span className="atlas-oh-list-finding"><Network size={12} aria-hidden />{relationLabels[r.kind]}</span><span className="atlas-oh-connection-status" data-caution={r.basis==='source_hypothesis' || r.contested}>{r.contested ? 'Contested · ' : ''}{r.basis==='source_hypothesis' ? 'Source hypothesis' : 'Source reported'}</span></span></span>
                    <ArrowRight className="atlas-oh-list-open" size={14} aria-hidden />
                  </button>;
                }) : <p className="atlas-oh-note">No reviewed connections in this entry.</p>}</div>
              </section>
            </div>
          </section>
          </>}
        </div>
        <aside ref={detail} className="atlas-oh-detail" aria-label="One Health source details">{selected ? <HealthDetails key={selected.id} item={selected} nodes={items} onReport={onReport} /> : <p>No eligible observations. Try another report or filter.</p>}</aside>
      </div>
    </> : <p className="atlas-empty">{entryFilters.length ? "No entries match these filters. Clear the entry filters or choose another combination." : "No One Health observations within these reporting filters. Unreviewed entries are not evidence of absence."}</p>}
    </div>
  </section>;
});

const evidenceTypes: Record<Relation["evidence_types"][number], string> = {
  epidemiological_investigation: "Investigation", human_testing: "Human testing", animal_testing: "Animal testing",
  environmental_testing: "Environment testing", food_testing: "Food testing", genomic_analysis: "Genomics",
  traceback: "Traceback", experimental_study: "Experiment", ecological_analysis: "Ecology", source_assessment: "Source assessment",
};

function HealthEvidence({relations,selected,onSelect,reviewHelp}:{relations:Relation[];selected?:string;onSelect:(id:string)=>void;reviewHelp:ReactNode}) {
  const types = (Object.keys(evidenceTypes) as Relation["evidence_types"]).filter(type=>relations.some(r=>r.evidence_types.includes(type)));
  if (!relations.length) return <p className="atlas-empty">No reviewed relationships in this selection. Observations alone do not establish a connection.</p>;
  return <div className="atlas-oh-table atlas-oh-matrix"><table><caption className="sr-only">Relationship evidence types</caption><thead><tr><th scope="col"><div className="atlas-oh-relationship-heading">Relationship{reviewHelp}</div></th>{types.map(type=><th scope="col" key={type} title={words(type)}>{evidenceTypes[type]}</th>)}</tr></thead><tbody>{relations.map(r=><tr key={r.id} data-selected={selected===r.id} onClick={()=>onSelect(r.id)}>
      <th scope="row"><button aria-pressed={selected===r.id}>{r.label}</button><div className="atlas-oh-relationship-badges"><span className="atlas-oh-list-finding"><Network size={12} aria-hidden />{relationLabels[r.kind]}</span><span className="atlas-select-badge" data-caution={r.basis === "source_hypothesis" || undefined}>{r.basis === "source_hypothesis" ? <CircleHelp size={12} aria-hidden /> : <FileText size={12} aria-hidden />}{r.basis === "source_hypothesis" ? "Source hypothesis" : "Source reported"}</span>{r.contested && <span className="atlas-select-badge" data-caution="true"><TriangleAlert size={12} aria-hidden />Contested</span>}</div></th>
      {types.map(type=><td key={type}>{r.evidence_types.includes(type) ? <button className="atlas-oh-cited" aria-label={`${evidenceTypes[type]} cited for ${r.label}`} aria-pressed={selected===r.id}><Check size={16} aria-hidden /><span>Cited</span></button> : <span aria-label="Evidence type not recorded">—</span>}</td>)}
    </tr>)}</tbody></table></div>;
}

function HealthOverview({rows,view,onOpen,onReport,footerTarget,toolsTarget}:{toolsTarget:HTMLElement|null;rows:AtlasRecord[];view:AtlasSelectedOneHealth;onOpen:(id:string,nodeId?:string)=>void;onReport:(ids:string[],expand?:boolean)=>void;footerTarget:HTMLElement|null}) {
  const {bundle,tracks}=useAtlas();
  const [query,setQuery]=useAtlasPanelState("health.overview.query", "");
  const [page,setPage]=useAtlasPanelState("health.overview.page", 0);
  const [sort,setSort]=useAtlasPanelState<{key:"report"|"evidence"|Domain;direction:"ascending"|"descending"}>("health.overview.sort", {key:"evidence",direction:"descending"});
  const scroll=useRef<HTMLDivElement>(null);
  const evidence=useMemo(()=>healthOverviewEvidence(view),[view]);
  const reviews=useMemo(()=>new Map(view.reviews.map(r=>[r.record_id,r])),[view]);
  const reviewedIds=useMemo(()=>new Set(bundle.one_health_reviews.map(r=>r.record_id)),[bundle]);
  const entries=useMemo(()=>rows.filter(r=>`${r.title} ${tracks.get(r.track)?.label ?? ""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>{
    const left=evidence.get(a.id),right=evidence.get(b.id);
    const difference=sort.key==="evidence" ? -compareHealthEvidence(left?.rank,right?.rank)
      : sort.key==="report" ? (tracks.get(a.track)?.label ?? a.title).localeCompare(tracks.get(b.track)?.label ?? b.title)
      : (left?.nodes.filter(n=>n.domain===sort.key).length ?? 0)-(right?.nodes.filter(n=>n.domain===sort.key).length ?? 0);
    return difference*(sort.direction==="ascending"?1:-1) || b.publication.localeCompare(a.publication) || a.id.localeCompare(b.id);
  }),[rows,query,tracks,evidence,sort]);
  const pageCount=Math.max(1,Math.ceil(entries.length/20)), currentPage=Math.min(page,pageCount-1);
  const columns=domains.filter(d=>d.id!=="unknown" || [...evidence.values()].some(e=>e.nodes.some(n=>n.domain==="unknown")));
  const resetSort=()=>{setSort({key:"evidence",direction:"descending"});setPage(0);scroll.current?.scrollTo({top:0,left:0});};
  const changeSort=(key:typeof sort.key)=>{
    setSort({key,direction:sort.key===key ? sort.direction==="ascending"?"descending":"ascending" : key==="report"?"ascending":"descending"});
    setPage(0);
  };
  const overviewHelp=<AtlasScope label="Overview ordering and scope" title="Evidence coverage"><p>Default order: reported, uncontested relationships first; then distinct evidence types, supporting documents, source passages and observations, each in descending order. Ties use the most recent publication date.</p><p>Counts use observations belonging to each report entry and relationships explicitly supported by that entry. Hypotheses and contested relationships are shown separately and do not contribute to relationship support counts. Documents and passages are counted once per entry.</p><p>This is a reading order based on recorded support, not a confidence score. More evidence does not establish causation or stronger study quality. Positive and negative findings have equal weight. Domain headings sort by observation count; the report heading sorts by topic name.</p></AtlasScope>;
  const heading=(key:typeof sort.key,label:string)=>{
    const SortIcon=sort.key===key ? sort.direction==="ascending"?ArrowUp:ArrowDown : ArrowUpDown;
    return <th scope="col" key={key} aria-sort={sort.key===key?sort.direction:"none"}><div className="atlas-oh-relationship-heading"><button onClick={()=>changeSort(key)} title={key==="report"?"Sort by topic name":key==="evidence"?"Sort by recorded evidence coverage":`Sort by ${label.toLowerCase()} observation count`}><span>{label}</span><SortIcon className="atlas-oh-sort-icon" size={12} aria-hidden /></button>{key === "report" && overviewHelp}</div></th>;
  };
  useEffect(()=>{scroll.current?.scrollTo({top:0});},[currentPage,query,sort,rows]);
  return <div className="atlas-oh-overview">
    {toolsTarget && createPortal(<><label className="atlas-oh-search"><span className="sr-only">Report entries</span><input type="search" aria-label="Search One Health report entries" placeholder="Search title or topic…" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} /></label>
      <button className="atlas-oh-sort-reset" onClick={resetSort} disabled={sort.key==="evidence"&&sort.direction==="descending"} title="Reset to evidence order" aria-label="Reset sort"><RotateCcw size={16} aria-hidden /></button>
    </>,toolsTarget)}
    <div ref={scroll} className="atlas-oh-table atlas-oh-overview-scroll"><table><caption className="sr-only">Report entries by One Health domain and recorded evidence coverage</caption><thead><tr>{heading("report","Report entry & review")}{heading("evidence","Evidence")}{columns.map(d=>heading(d.id,d.id === "food" ? "Food" : d.label))}</tr></thead><tbody>{entries.slice(currentPage*20,currentPage*20+20).map(row=>{
      const support=evidence.get(row.id),observations=support?.nodes ?? [],review=reviews.get(row.id);
      const status=review ? review.outcome === "reviewed" ? "Complete for stated scope" : words(review.outcome) : reviewedIds.has(row.id) ? "Support outside selection" : "Unreviewed";
      return <tr key={row.id} data-record-id={row.id}><th scope="row"><button title={row.title} onClick={()=>observations.length ? onOpen(row.id) : onReport([row.id],true)}>{tracks.get(row.track)?.label ?? row.title}</button><small>{formatDate(row.publication)} · {row.source}</small><span className="atlas-oh-review-state" title={review?.scope}>{status}</span></th>
        <td className="atlas-oh-evidence-counts"><strong>{support?.reported ?? 0} <span>reported {support?.reported===1?"link":"links"}</span></strong><small>{support?.types.size ?? 0} types · {support?.documents.size ?? 0} {support?.documents.size===1?"doc":"docs"}</small><small>{support?.passages.size ?? 0} passages · {observations.length} observations</small>{Boolean(support?.hypotheses)&&<small className="atlas-oh-evidence-caution">{support!.hypotheses} hypotheses</small>}{Boolean(support?.contested)&&<small className="atlas-oh-evidence-caution">{support!.contested} contested</small>}</td>
        {columns.map(d=>{
          const domainNodes=observations.filter(n=>n.domain===d.id),results=[...new Set(domainNodes.map(n=>n.finding))];
          return <td key={d.id} data-domain={d.id} data-count={domainNodes.length}>{results.length ? <button onClick={()=>onOpen(row.id,domainNodes[0].id)} aria-label={`Open ${d.label} observations for ${row.title}`}><span className="atlas-oh-domain-count">{domainNodes.length} {domainNodes.length===1?"observation":"observations"}</span>{results.map(f=><span className="atlas-oh-finding" data-negative={f==="agent_not_detected"} key={f}>{f==="agent_not_detected" ? "Not detected" : findings[f]}</span>)}</button> : <span className="atlas-oh-empty-cell" aria-label={review ? "No domain observation recorded" : status}>{review ? "—" : "?"}</span>}</td>;
        })}</tr>;
    })}</tbody></table>{!entries.length && <p className="atlas-empty">No matching report entries.</p>}</div>
    <p className="atlas-oh-note">One row per report entry. — no domain observation recorded · ? review unavailable. “Not detected” applies only to sampled material.</p>
    {footerTarget && createPortal(<ReportPagination entity="One Health overview" position="bottom" index={currentPage} items={Array.from({length:pageCount},(_,index)=>({value:String(index),label:`${index+1} / ${pageCount}`}))} onChange={setPage} />,footerTarget)}
  </div>;
}

function HealthMethods() {
  return <div className="atlas-literature">
    <p>ATLAS UI visualizes reviewed ATLAS exports. These papers inform the presentation; source passages in the details panel support individual observations and relationships. The papers do not validate this interface or its records.</p>
    <h3><Network size={16} aria-hidden />Network: distinguish exposure from infection</h3><p>Domain columns retain the reported entities, findings and observation scope. Connections appear only when exported; arrows require an explicit direction. This distinction follows the successive barriers discussed by <a href="https://doi.org/10.1038/nrmicro.2017.45" target="_blank" rel="noopener noreferrer">Plowright et al. (2017)</a>. Position and spacing do not encode time, distance or risk.</p>
    <h3><Grid2X2 size={16} aria-hidden />Evidence: inspect the types behind a relationship</h3><p>The matrix separates reported evidence types without ranking certainty. <a href="https://doi.org/10.1038/s41586-024-07849-4" target="_blank" rel="noopener noreferrer">Caserta et al. (2024)</a> combine epidemiological and genomic investigation; <a href="https://doi.org/10.1038/s41576-023-00649-y" target="_blank" rel="noopener noreferrer">Djordjevic et al. (2024)</a> discuss genomic methods and their strengths. This motivates keeping evidence types inspectable. Genomic association alone is not displayed as transmission direction. A cell opens the whole relationship evidence because the export has no quotation binding for each type.</p>
    <h3><Rows3 size={16} aria-hidden />Overview: distinguish review coverage from absence</h3><p>The entry by domain view exposes findings alongside review status, informed by the integrated surveillance goals of <a href="https://doi.org/10.1016/j.onehlt.2023.100617" target="_blank" rel="noopener noreferrer">OHHLEP et al. (2023)</a>. An empty cell is not a negative test or an uninvestigated domain. Counts describe source observations and report entries, not incidence or surveillance sensitivity.</p>
    <h3><Microscope size={16} aria-hidden />Sampling and comparability</h3><p>The <a href="https://doi.org/10.2903/j.efsa.2025.9759" target="_blank" rel="noopener noreferrer">EFSA and ECDC report (2025)</a> distinguishes surveillance systems by comparability. ATLAS retains population, period, sample unit and method. Shared plotting of positivity requires linked numerators and denominators with compatible sampling; the interface does not derive these from narrative proximity.</p>
    <h3><CalendarDays size={16} aria-hidden />Aligned time, sampling and environmental context</h3><p>The <a href="https://doi.org/10.1038/s41586-022-05506-2" target="_blank" rel="noopener noreferrer">Eby et al. (2023)</a> study aligns ecological and spillover observations over time. ATLAS uses alignment to inspect reported dates; it does not infer the study’s ecological mechanisms in other records. Month and year placement ranges preserve date precision, and reporting cutoffs remain separate from observation events.</p><p>Sampling panels follow the exported decision on matched tested and positive units. Fractions are descriptive results from the sampled material, with no assumed population representativeness or confidence interval. Environmental panels distinguish measured variables, attributed hypotheses, reported conditions, interventions and evaluated effects. An intervention’s position beside an observation is not evidence that it caused a change.</p>
    <h3><BookOpen size={16} aria-hidden />References</h3><ol className="atlas-references">
      <li>Plowright RK et al. (2017). <a href="https://doi.org/10.1038/nrmicro.2017.45" target="_blank" rel="noopener noreferrer">Pathways to zoonotic spillover.</a> <i>Nature Reviews Microbiology</i> 15, 502–510.</li>
      <li>Caserta LC et al. (2024). <a href="https://doi.org/10.1038/s41586-024-07849-4" target="_blank" rel="noopener noreferrer">Spillover of highly pathogenic avian influenza H5N1 virus to dairy cattle.</a> <i>Nature</i> 634, 669–676.</li>
      <li>Djordjevic SP et al. (2024). <a href="https://doi.org/10.1038/s41576-023-00649-y" target="_blank" rel="noopener noreferrer">Genomic surveillance for antimicrobial resistance — a One Health perspective.</a> <i>Nature Reviews Genetics</i> 25, 142–157. Published online in 2023; cited by the 2024 journal issue.</li>
      <li>One Health High-Level Expert Panel (OHHLEP) et al. (2023). <a href="https://doi.org/10.1016/j.onehlt.2023.100617" target="_blank" rel="noopener noreferrer">Developing One Health surveillance systems.</a> <i>One Health</i> 17, 100617.</li>
      <li>EFSA and ECDC (2025). <a href="https://doi.org/10.2903/j.efsa.2025.9759" target="_blank" rel="noopener noreferrer">The European Union One Health 2024 Zoonoses Report.</a> <i>EFSA Journal</i> 23(12), e9759. The title refers to the 2024 reporting year.</li>
    <li>Eby P et al. (2023). <a href="https://doi.org/10.1038/s41586-022-05506-2" target="_blank" rel="noopener noreferrer">Pathogen spillover driven by rapid changes in bat ecology.</a> <i>Nature</i> 613, 340–344. Published online in 2022; cited by the 2023 journal issue.</li>
    </ol>
  </div>;
}

type HealthInteractions = { selected?:string; highlighted:string; onHover:(id:string)=>void; onLeave:()=>void; onSelect:(id:string)=>void };

function HealthLanes({ nodes, relations, selected, highlighted, onHover, onLeave, onSelect }: { nodes:Node[]; relations:Relation[] } & HealthInteractions) {
  const arrow=useId();
  const { ref, size: measured } = useElementSize<SVGSVGElement>();
  const lanes=useMemo(()=>domains.filter(d=>nodes.some(n=>n.domain===d.id)),[nodes]);
  const { width, minimumWidth, height, points, paths, lanes: columns } = useMemo(()=>healthLayout(nodes, relations, lanes.map(d=>d.id), measured?.width ?? 600),[nodes,relations,lanes,measured?.width]);
  const active = points.has(highlighted) || paths.has(highlighted) ? highlighted : "";
  const activeRelation = relations.find(r=>r.id===active);
  const related = new Set(activeRelation ? [activeRelation.from_node_id,activeRelation.to_node_id] : [active]);
  if (!activeRelation) for (const r of relations) if(r.from_node_id===active || r.to_node_id===active) { related.add(r.from_node_id);related.add(r.to_node_id); }
  if (!nodes.length) return <p className="atlas-empty">No episode or surveillance observations in this selection. Background context remains in the observation list.</p>;
  return <m.svg ref={ref} initial={false} animate={{ viewBox: `0 0 ${width} ${height}` }} preserveAspectRatio="xMinYMin meet" style={{"--atlas-network-min-width":`${minimumWidth}px`} as CSSProperties} role="group" aria-label="One Health evidence network" onPointerLeave={onLeave}>
    <defs><marker id={arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10" fill="none" stroke="currentColor" /></marker></defs>
    {columns.map(column=>{const domain=lanes.find(d=>d.id===column.id)!;const Icon=domainIcons[domain.id];return <g key={column.id} className="atlas-oh-lane-group" data-domain={column.id}><m.rect initial={false} animate={{ x: column.x, width: column.width, height }} y="0" rx="12" className="atlas-oh-lane" /><m.foreignObject initial={false} animate={{ x: column.x, width: column.width }} y="4" height="36"><div className="atlas-oh-lane-title" data-compact={column.width < 120}><Icon size={14} aria-hidden />{column.id === "food" ? "Food" : domain.label}</div></m.foreignObject></g>;})}
    <AnimatePresence initial={false}>{relations.map(r=>{const path=paths.get(r.id);if(!path)return null;return <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={r.id} data-entry-id={r.id} data-highlighted={highlighted===r.id} role="button" tabIndex={0} aria-label={`${r.label}. ${words(r.kind)}${r.contested ? '. Contested' : ''}`} onClick={()=>onSelect(r.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(r.id);}}} onPointerEnter={()=>onHover(r.id)} onPointerLeave={onLeave} onFocus={()=>onHover(r.id)} onBlur={onLeave} className="atlas-oh-edge" data-dimmed={!!active && !(r.id===active || r.from_node_id===active || r.to_node_id===active)} data-kind={r.kind} data-basis={r.basis} data-selected={selected===r.id} aria-pressed={selected===r.id}><m.path initial={false} animate={{ d: path }} stroke="transparent" strokeWidth="12" fill="none" /><m.path initial={false} className="atlas-oh-edge-clearance" animate={{ d: path }} /><m.path initial={false} className="atlas-oh-edge-line" animate={{ d: path }} markerEnd={r.directed?`url(#${arrow})`:undefined} /></m.g>;})}</AnimatePresence>
    <AnimatePresence initial={false}>{nodes.map((n, index)=>{const p=points.get(n.id)!;return <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={n.id} data-entry-id={n.id} data-highlighted={highlighted===n.id} role="button" tabIndex={0} aria-label={n.label} onPointerEnter={()=>onHover(n.id)} onPointerLeave={onLeave} onFocus={()=>onHover(n.id)} onBlur={onLeave} data-dimmed={!!active && !related.has(n.id)} data-domain={n.domain} data-selected={selected===n.id} aria-pressed={selected===n.id} className="atlas-oh-node" onClick={()=>onSelect(n.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(n.id);}}}>
        <m.g initial={false} animate={{ x: p.x, y: p.y }}><NodeShape domain={n.domain} /><text textAnchor="middle" y="5" aria-hidden>{index+1}</text></m.g>
        <m.foreignObject initial={false} animate={{ x: p.x-p.width/2+4, y: p.y+24, width: p.width-8 }} height="80"><div className="atlas-oh-node-label"><strong title={n.label}>{n.label}</strong><span data-negative={n.finding === "agent_not_detected"}>{n.finding === "agent_not_detected" ? "Not detected" : findings[n.finding]}</span></div></m.foreignObject>
      </m.g>;})}</AnimatePresence>
  </m.svg>;
}

const domainIcons = { human: UserRound, animal: PawPrint, environment: Leaf, food: Wheat, unknown: CircleHelp };
function NodeShape({domain}:{domain:Domain}) {return domain==='human'?<circle r="17" />:domain==='environment'?<path d="M0-20L20 0L0 20L-20 0Z" />:<rect x="-17" y="-17" width="34" height="34" rx={domain==='animal'?8:domain==='unknown'?17:1} />;}
function HealthObservationList({ nodes, networkNodes, selected, highlighted, onHover, onLeave, onSelect }: { nodes: Node[]; networkNodes: Node[] } & HealthInteractions) {
  return <ul className="atlas-oh-observation-list" aria-label="One Health observations"><AnimatePresence initial={false} mode="popLayout">{nodes.map(node => {
    const index = networkNodes.findIndex(n => n.id === node.id);
    const Icon = domainIcons[node.domain];
    return <m.li layout="position" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} key={node.id} data-domain={node.domain}>
      <button className="atlas-oh-entry" type="button" data-entry-id={node.id} data-highlighted={highlighted===node.id} aria-label={node.label} aria-pressed={selected === node.id} onPointerEnter={()=>onHover(node.id)} onPointerLeave={onLeave} onFocus={()=>onHover(node.id)} onBlur={onLeave} onClick={()=>onSelect(node.id)}>
        <span className="atlas-oh-list-marker" aria-hidden>{index >= 0 ? <svg viewBox="-24 -24 48 48"><NodeShape domain={node.domain} /><text textAnchor="middle" y="5">{index + 1}</text></svg> : <Icon size={20} />}</span>
        <span className="atlas-oh-list-content">
          <strong title={node.label}>{node.label}</strong>
          <span className="atlas-oh-list-facts"><span className="atlas-oh-list-finding" data-caution={node.finding === 'unresolved'}><Activity size={12} aria-hidden />{findings[node.finding]}</span>{(node.observation_date.value || (node.period_start.value && node.period_end.value)) && <span><CalendarDays size={12} aria-hidden />{dateLabel(node)}</span>}</span>
        </span>
        <ArrowRight className="atlas-oh-list-open" size={14} aria-hidden />
      </button>
    </m.li>;
  })}</AnimatePresence></ul>;
}

const HealthDetails = memo(function HealthDetails({item,nodes,onReport}:{item:Node|Relation;nodes:Node[];onReport:(ids:string[],expand?:boolean)=>void}) {
  const {bundle,atlasDocuments,englishTitle}=useAtlas();
  const refs=useMemo<AtlasDetailRef[]>(()=>{
    const requested:AtlasDetailRef[]=item.evidence_ids.map(id=>({collection:"evidence",id}));
    if ("domain" in item) requested.push(...item.measure_ids.map(id=>({collection:"metrics.measures" as const,id})));
    else {
      const assertionIds=new Set([item.source_assertion_id,...item.comparison_ids.flatMap(id=>bundle.comparisons.find(comparison=>comparison.id===id)!.participant_ids)]);
      requested.push(...[...assertionIds].map(id=>({collection:"assertions" as const,id})));
    }
    return requested;
  },[item,bundle.comparisons]);
  const {data,error,retry}=useAtlasDetails(refs);
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  const node='domain' in item?item:null;
  const relation='kind' in item?item:null;
  const DomainIcon=node ? domainIcons[node.domain] : Network;
  const values=node?.measure_ids.map(id=>data.get("metrics.measures",id)) ?? [];
  const places=bundle.places.filter(p=>node?.place_ids.includes(p.id));
  const fields:Record<string,string>={
    ...(node?{"Finding":findings[node.finding],"Organism or agent":node.agent.value??words(node.agent.status),"Agent type":words(node.agent_kind),"Host or taxon":node.taxon.value??words(node.taxon.status),"Material":node.material.value??words(node.material.status),"Sample unit":node.sampling.sample_unit.value??words(node.sampling.sample_unit.status),"Sampling frame":node.sampling.frame.value??words(node.sampling.frame.status),"Collection method":node.sampling.collection_method.value??words(node.sampling.collection_method.status),"Test method":node.sampling.test_method.value??words(node.sampling.test_method.status)}:{}),
    ...(relation?{"Relationship":words(relation.kind),"Source assessment":relation.basis==='source_hypothesis'?'Source hypothesis':'Source reported',"Source wording":relation.source_certainty.value??words(relation.source_certainty.status),"Direction":words(relation.direction_basis),[relation.directed ? "From" : "Endpoint 1"]:nodes.find(n=>n.id===relation.from_node_id)?.label??relation.from_node_id,[relation.directed ? "To" : "Endpoint 2"]:nodes.find(n=>n.id===relation.to_node_id)?.label??relation.to_node_id,"Evidence types":relation.evidence_types.map(words).join(', ')}:{}),
    "Observation date":dateLabel(item),"Date basis":words(item.date_basis),"Period":item.period_label.value??words(item.period_label.status),
  };
  return <><header><div className="atlas-oh-detail-top"><span className="atlas-oh-detail-kind"><DomainIcon size={15} aria-hidden />{node ? domains.find(d=>d.id===node.domain)!.label : relation ? relationLabels[relation.kind] : "Evidence"}{node && <small>{words(node.scope)}</small>}</span><button aria-label="View reports" onClick={()=>onReport(item.record_ids,true)}><FileText size={13} aria-hidden />Reports<ArrowRight size={12} aria-hidden /></button></div><h3>{item.label}</h3><div className="atlas-oh-info-finding" data-caution={relation?.basis==='source_hypothesis' || node?.finding==='unresolved'}><Activity size={15} aria-hidden /><strong>{node ? findings[node.finding] : relation?.basis==='source_hypothesis' ? 'Source hypothesis' : 'Source reported'}</strong></div></header>
    {relation?.contested && <p className="atlas-status" data-tone="warning"><TriangleAlert size={14} aria-hidden />Contested proposition</p>}
    <dl>{Object.entries(fields).filter(([key])=>!["Finding", "Source assessment", "Sample unit", "Sampling frame", "Collection method", "Test method", "Material", "Agent type", "Period", "Date basis"].includes(key)).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
    <details className="atlas-oh-methods"><summary><Microscope size={14} aria-hidden />Sampling, dates & methods<ChevronDown size={14} aria-hidden /></summary><dl>{Object.entries(fields).filter(([key])=>["Sample unit", "Sampling frame", "Collection method", "Test method", "Material", "Agent type", "Period", "Date basis"].includes(key)).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></details>
    {item.uncertainty && <section className="atlas-oh-detail-note"><h4><Info size={14} aria-hidden />Limits & interpretation</h4><p>{item.uncertainty}</p></section>}
    {item.date_note && <section className="atlas-oh-detail-note"><h4><CalendarDays size={14} aria-hidden />Date context</h4><p>{item.date_note}</p></section>}
    {relation && <><p>{relation.reason}</p><p>{relation.scope}</p><blockquote>{data.get("assertions",relation.source_assertion_id).text}</blockquote>{relation.comparison_ids.map(id=>{const c=bundle.comparisons.find(c=>c.id===id)!;return <details key={id}><summary>{words(c.kind)} · comparison evidence</summary>{c.participant_ids.map(id=><p key={id}>{data.get("assertions",id).text}</p>)}</details>;})}<p>{words(relation.review_state)} · reviewed {formatDate(relation.reviewed_at)}</p></>}
    {values.map(m=><article className="atlas-oh-measure" key={m.measure_id}><strong>{metricValue(m)} <small>{words(m.unit)}</small></strong><b>{m.label}</b><span>{m.geography.value} · {m.period_label}</span><span>{words(m.count_kind)} · {m.as_of.value ? `As of ${m.as_of.value}` : words(m.date_basis)}</span><span>Denominator: {m.denominator??words(m.denominator_status)}{m.denominator_population.value?` · ${m.denominator_population.value}`:''}</span><p>{m.semantic_note}</p></article>)}
    {node && <><h4><MapPin size={14} aria-hidden />Reviewed locations</h4><ReviewedPlaces placeIds={node.place_ids} /><LocationBadges codes={[...new Set(places.flatMap(p=>p.area_codes))]} /><p>{node.location_note}</p></>}
    <h4><FileText size={14} aria-hidden />Source evidence</h4>{relation && <p className="atlas-oh-note">These passages support the relationship as a whole. The export does not assign individual passages to evidence types.</p>}{item.evidence_ids.map(id=>{const e=data.get("evidence",id);const d=atlasDocuments.get(e.document_id)!;return <div className="atlas-oh-source" key={id}><a href={d.url} target="_blank" rel="noopener noreferrer">{englishTitle(d)}<ExternalLink size={12} aria-hidden /></a><small>Published {formatDate(d.publication)} · Captured {formatDate(d.capture)}{e.page!==null?` · Page ${e.page}`:''}{e.section?` · ${e.section}`:''}</small><SourceQuotation quote={e.quote} evidenceId={e.id} /></div>;})}
  </>;
});
function ReviewedPlaces({placeIds}:{placeIds:string[]}) {
  const {bundle}=useAtlas();const places=useMemo(()=>bundle.places.filter(p=>placeIds.includes(p.id)),[bundle,placeIds]);
  const frame=useMemo(()=>fitChainMap(places,460,250),[places]);const dots=useMemo(()=>frame?chainLandDots(frame):'', [frame]);
  if(!frame)return <p>Unlocated at reviewed scope</p>;
  return <><svg viewBox="0 0 460 250" role="img" aria-label="Reviewed reference locations; no inferred routes"><path className="atlas-chain-land" d={dots}/>{places.map((p,i)=>{const point=frame.project(p);return <g key={p.id}><circle cx={point.x} cy={point.y} r="7" fill="var(--primary)"/><text x={point.x+11} y={point.y+4} fill="var(--foreground)" fontSize="13">{i+1}</text></g>;})}</svg><ol>{places.map(p=><li key={p.id}>{p.label} · {words(p.precision)}</li>)}</ol></>;
}
function SurveillancePanels({nodes}:{nodes:Node[]}) {
  if(!nodes.length)return null;
  return <AtlasDisclosure className="atlas-oh-surveillance" unmountOnClose summary={<summary>Source measurements by population</summary>}>{()=><SurveillanceDetails nodes={nodes} />}</AtlasDisclosure>;
}
function SurveillanceDetails({nodes}:{nodes:Node[]}) {
  const refs=useMemo<AtlasDetailRef[]>(()=>[...new Set(nodes.flatMap(node=>node.measure_ids))].map(id=>({collection:"metrics.measures",id})),[nodes]);
  const {data,error,retry}=useAtlasDetails(refs);
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  return <><p>Each population retains its units and reporting period. Animal observations have no approved longitudinal connections.</p><div>{nodes.map(n=><article key={n.id} data-domain={n.domain}><h4>{n.taxon.value??n.label}</h4>{n.measure_ids.map(id=>{const m=data.get("metrics.measures",id);return <p key={id}><strong>{metricValue(m)}</strong> {m.label}<small>{words(m.unit)} · {m.geography.value} · {m.period_label}{m.as_of.value?` · As of ${m.as_of.value}`:''}</small></p>;})}</article>)}</div></>;
}
