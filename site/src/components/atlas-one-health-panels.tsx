"use client";
import { AnimatePresence, motion as m } from "motion/react";
import { SourceQuotation } from "./atlas-source-text";
import { useEffect, useId, useMemo, useRef } from "react";
import { ArrowRight, CalendarDays, ChevronDown, ExternalLink, FileText } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useAtlas, useAtlasPanelState } from "./atlas-context";
import { AtlasDetailStatus, useAtlasDetails } from "./atlas-detail";
import { useElementSize } from "./use-element-size";
import { LocationBadges } from "./atlas-location-badges";
import { formatDate } from "@/lib/atlas";
import { healthPanelForEntry } from "@/lib/atlas-health-entries";
import { metricValue } from "@/lib/atlas-metrics";
import { observationTimeBounds, observationTimeLabel } from "@/lib/atlas-health-time";
import type { AtlasSelectedOneHealth } from "@/lib/atlas-vendor/browser/0.3/atlas.js";
import type { AtlasOneHealthNode, AtlasOneHealthTiming, AtlasOneHealthSamplingAssessment, AtlasOneHealthContext, AtlasSelectedOneHealthPanel } from "@/lib/atlas-contract";
import type { AtlasDetailRef } from "@/lib/atlas-browser";

type Timing = AtlasSelectedOneHealthPanel<AtlasOneHealthTiming>;
type Sampling = AtlasSelectedOneHealthPanel<AtlasOneHealthSamplingAssessment>;
type Context = AtlasSelectedOneHealthPanel<AtlasOneHealthContext>;
type PanelItem = Timing | Sampling | Context;
type PanelMode = "timeline" | "sampling" | "environment";
const words = (value:string) => value.replaceAll("_", " ");
const domainNames = {human:"People",animal:"Animals",environment:"Environment",food:"Food",unknown:"Unknown"};
const contextNames = {measured_covariate:"Measured variable",reported_condition:"Reported condition",source_hypothesis:"Source hypothesis",reported_intervention:"Reported intervention",evaluated_effect:"Evaluated effect"};
const isSampling = (item:PanelItem):item is Sampling => "positive_measure_id" in item;
const isContext = (item:PanelItem):item is Context => "node_ids" in item;
const title = (item:PanelItem,nodes:Map<string,AtlasOneHealthNode>) => isContext(item) ? item.label : nodes.get(item.node_id)!.label;
const kind = (item:PanelItem) => isContext(item) ? contextNames[item.kind] : isSampling(item) ? "Sampling assessment" : words(item.time.kind);

export function AtlasHealthPanels({mode,view,reportId,nodeIds,onReport,mergedTimeline=false}:{mergedTimeline?:boolean;mode:PanelMode;view:AtlasSelectedOneHealth;reportId:string;nodeIds:Set<string>;onReport:(ids:string[],expand?:boolean)=>void}) {
  const [selection,setSelection]=useAtlasPanelState(`health.${mode}.${reportId}.selection`, "");
  const [layers,setLayers]=useAtlasPanelState("health.timeline.layers", ["observations","environment","interventions"]);
  const combined = mode === "timeline" && mergedTimeline;
  const detail=useRef<HTMLElement>(null);
  const nodes=useMemo(()=>new Map([...view.nodes,...view.undated_nodes].map(n=>[n.id,n])),[view]);
  const {dated, undated, cutoffs, rows} = useMemo(() => {
    const relevant=(row:PanelItem)=>healthPanelForEntry(row,reportId,nodeIds);
    const inLayer = (item: PanelItem) => !combined || layers.includes(isContext(item) ? (item.kind === "reported_intervention" || item.kind === "evaluated_effect" ? "interventions" : "environment") : "observations");
    const dated:PanelItem[]=(mode==="timeline" ? [...view.timings,...(combined ? view.contexts : [])] : mode==="sampling" ? view.sampling_assessments : view.contexts).filter(relevant).filter(inLayer);
    const undated:PanelItem[]=(mode==="timeline" ? [...view.undated_timings,...(combined ? view.undated_contexts : [])] : mode==="sampling" ? view.undated_sampling_assessments : view.undated_contexts).filter(relevant).filter(inLayer);
    const cutoffs=mode==="timeline" && (!combined || layers.includes("observations")) ? view.reporting_cutoffs.filter(relevant) : [];
    return {dated, undated, cutoffs, rows: [...dated,...undated,...cutoffs]};
  }, [mode, view, reportId, nodeIds, combined, layers]);
  const selected=rows.find(r=>r.id===selection) ?? rows[0];
  useEffect(()=>{detail.current?.scrollTo({top:0});},[selected?.id]);
  const heading=mode==="timeline" ? "Aligned evidence timeline" : mode==="sampling" ? "Sampling & positivity" : "Environment & interventions";
  return <div className="atlas-oh-layout atlas-oh-analytic" data-view={mode}>
    <div className="atlas-oh-main"><h3 className="sr-only">{heading}</h3>
      {combined && <div className="atlas-oh-timeline-layers" role="group" aria-label="Timeline layers">{["observations","environment","interventions"].map(layer=><button key={layer} role="switch" aria-checked={layers.includes(layer)} onClick={()=>setLayers(current=>current.includes(layer)?current.filter(item=>item!==layer):[...current,layer])}><span className="atlas-oh-layer-switch" aria-hidden="true" />{layer === "observations" ? "Observations" : layer === "environment" ? "Environment" : "Interventions"}</button>)}</div>}
      {mode==="sampling" ? <SamplingTable rows={[...dated,...undated].filter(isSampling)} nodes={nodes} selected={selected?.id} onSelect={setSelection} /> : <>
        {mode==="environment" && <p className="atlas-oh-note">Measured variables, source interpretations and reported actions retain separate meanings. Alignment does not establish an effect.</p>}
        {dated.length ? <EvidenceTimeline rows={dated} nodes={nodes} selected={selected?.id} onSelect={setSelection} /> : <p className="atlas-empty">No dated {mode==="timeline" ? "observation statements" : "context or intervention statements"} in this selection.</p>}
        {dated.length>0 && <div className="atlas-oh-time-legend"><div className="atlas-oh-key" aria-label="Timeline date precision"><span><i data-time="day" />Exact day</span><span><i data-time="interval" />Reported interval</span><span><i data-time="uncertain" />Month/year or uncertain time</span></div><p className="atlas-oh-note">A placement range does not mean continuous activity.</p></div>}
        {undated.length>0 && <section className="atlas-oh-time-list"><h4>Undated or incomplete dates <span>{undated.length}</span></h4>{undated.map(item=><button key={item.id} aria-pressed={selected?.id===item.id} onClick={()=>setSelection(item.id)}><strong>{title(item,nodes)}</strong><small>{kind(item)} · {observationTimeLabel(item.time)}</small></button>)}</section>}
      </>}
      {cutoffs.length>0 && <section className="atlas-oh-time-list"><h4>Reporting cutoffs <span>{cutoffs.length}</span></h4><p className="atlas-oh-note">Report coverage dates, separate from observation events.</p>{cutoffs.map(item=><button key={item.id} aria-pressed={selected?.id===item.id} onClick={()=>setSelection(item.id)}><strong>{title(item,nodes)}</strong><small>{observationTimeLabel(item.time)}</small></button>)}</section>}
      {!rows.length && <p className="atlas-oh-note">No reviewed statements match this view and its selected layers. This is not evidence that sampling, environmental conditions or response actions were absent.</p>}
    </div>
    <aside ref={detail} className="atlas-oh-detail" aria-label="One Health panel source details">{selected ? <PanelDetails key={selected.id} item={selected} nodes={nodes} onReport={onReport} /> : <p className="atlas-oh-note">Select a report with reviewed statements for this view.</p>}</aside>
  </div>;
}

function EvidenceTimeline({rows,nodes,selected,onSelect}:{rows:PanelItem[];nodes:Map<string,AtlasOneHealthNode>;selected?:string;onSelect:(id:string)=>void}) {
  const pattern=useId();
  const {ref,size}=useElementSize<SVGSVGElement>();
  const width=Math.max(310,size?.width ?? 600),left=128,right=width-22;
  const ordered=useMemo(()=>rows.map(item=>({item,bounds:observationTimeBounds(item.time)!})).sort((a,b)=>{
    const group=(r:PanelItem)=>isContext(r)?contextNames[r.kind]:domainNames[nodes.get(r.node_id)!.domain];
    return group(a.item).localeCompare(group(b.item)) || a.bounds[0]-b.bounds[0] || a.item.id.localeCompare(b.item.id);
  }),[rows,nodes]);
  let start=Math.min(...ordered.map(r=>r.bounds[0])),end=Math.max(...ordered.map(r=>r.bounds[1]));
  const padding=Math.max(86_400_000,(end-start)*.06);start-=padding;end+=padding;
  const x=(time:number)=>left+(time-start)/(end-start)*(right-left);
  const height=ordered.length*68+54;
  return <Tooltip.Provider delayDuration={120}><div className="atlas-oh-time-chart"><m.svg ref={ref} initial={false} animate={{ viewBox: `0 0 ${width} ${height}` }} role="group" aria-label="Source evidence dates">
    <defs><pattern id={pattern} width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 6L6 0" stroke="currentColor" strokeOpacity=".3" strokeWidth="2" /></pattern></defs>
    {(right-left<280 ? [0,1] : [0,.5,1]).map(f=>{const value=start+(end-start)*f,px=x(value);return <g key={f} className="atlas-oh-time-axis"><line x1={px} x2={px} y1="30" y2={height-6} /><text x={px} y="16" textAnchor={f===0?"start":f===1?"end":"middle"}>{formatDate(new Date(value).toISOString().slice(0,10))}</text></g>;})}
    <AnimatePresence initial={false}>{ordered.map(({item,bounds},index)=>{const y=54+index*68,uncertain=item.time.precision!=="day" || item.time.certainty!=="exact",a=x(bounds[0]),b=x(bounds[1]);return <Tooltip.Root key={item.id}><Tooltip.Trigger asChild>
      <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="atlas-oh-time-point" data-selected={selected===item.id} data-kind={isContext(item)?item.kind:undefined} role="button" tabIndex={0} aria-label={`${title(item,nodes)}. ${kind(item)}. ${observationTimeLabel(item.time)}`} onClick={()=>onSelect(item.id)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelect(item.id);}}}>
        <m.rect initial={false} className="atlas-oh-time-hit" x="0" animate={{ y: y-20, width }} height="64" rx="8" />
        <m.foreignObject initial={false} x="4" animate={{ y: y-17, width: left-14 }} height="59"><div className="atlas-oh-time-label"><strong>{title(item,nodes)}</strong><small>{isContext(item)?contextNames[item.kind]:`${domainNames[nodes.get(item.node_id)!.domain]} · ${words(item.time.kind)}`}</small></div></m.foreignObject>
        {uncertain ? <m.rect initial={false} animate={{ x: a-3, y: y-8, width: Math.max(6,b-a+6) }} height="16" rx="4" fill={`url(#${pattern})`} stroke="currentColor" strokeDasharray="3 2" /> : a===b ? <m.circle initial={false} animate={{ cx: a, cy: y }} r="5" fill="currentColor" /> : <g><m.line initial={false} animate={{ x1: a, x2: b, y1: y, y2: y }} stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><m.circle initial={false} animate={{ cx: a, cy: y }} r="4" fill="currentColor" /><m.circle initial={false} animate={{ cx: b, cy: y }} r="4" fill="currentColor" /></g>}
      </m.g></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="atlas-figure-infocard" side="top" sideOffset={8} collisionPadding={12}><strong>{title(item,nodes)}</strong><span>{kind(item)} · {observationTimeLabel(item.time)}</span><span>{item.time.label}</span><span>{item.time.reason}</span>{item.contested && <span>Contested proposition</span>}<Tooltip.Arrow className="atlas-figure-info-arrow" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;})}</AnimatePresence>
  </m.svg></div></Tooltip.Provider>;
}

function SamplingTable({rows,nodes,selected,onSelect}:{rows:Sampling[];nodes:Map<string,AtlasOneHealthNode>;selected?:string;onSelect:(id:string)=>void}) {
  const {measures}=useAtlas();
  return <><p className="atlas-oh-note">Positive and tested units retain their reviewed sampling frame. Fractions describe the tested material, not population prevalence. No confidence intervals are inferred.</p>{rows.length>0 && <div className="atlas-oh-table atlas-oh-sampling"><table><caption className="sr-only">Reviewed sampling and positivity</caption><thead><tr><th scope="col">Sample & period</th><th scope="col">Positive / tested</th><th scope="col">Sample fraction</th></tr></thead><tbody>{rows.map(item=>{
    const positive=item.positive_measure_id ? measures.get(item.positive_measure_id)! : null,tested=item.tested_measure_id ? measures.get(item.tested_measure_id)! : null;
    return <tr key={item.id} data-selected={selected===item.id}><th scope="row"><button aria-pressed={selected===item.id} onClick={()=>onSelect(item.id)}>{title(item,nodes)}</button><small>{observationTimeLabel(item.time)}</small><small>{item.unit.value ?? words(item.unit.status)}</small></th><td className="atlas-oh-sample-count"><strong>{positive?metricValue(positive):"Unknown"}</strong><span> / {tested?metricValue(tested):"Unknown"}</span></td><td>{item.display==="proportion" && item.proportion!==null ? <button className="atlas-oh-fraction" aria-label={`Inspect sampling for ${title(item,nodes)}`} aria-pressed={selected===item.id} onClick={()=>onSelect(item.id)}><strong>{new Intl.NumberFormat("en-GB",{style:"percent",maximumFractionDigits:1}).format(item.proportion)}</strong><meter min="0" max="1" value={item.proportion} aria-label={`Sample fraction for ${title(item,nodes)}`} /></button> : <button aria-pressed={selected===item.id} onClick={()=>onSelect(item.id)}>Counts only</button>}</td></tr>;
  })}</tbody></table></div>}</>;
}

function PanelDetails({item,nodes,onReport}:{item:PanelItem;nodes:Map<string,AtlasOneHealthNode>;onReport:(ids:string[],expand?:boolean)=>void}) {
  const {bundle,atlasDocuments,englishTitle}=useAtlas();
  const refs=useMemo<AtlasDetailRef[]>(()=>{
    const requested:AtlasDetailRef[]=item.evidence_ids.map(id=>({collection:"evidence",id}));
    const measureIds=isContext(item) ? item.measure_ids : isSampling(item) ? [item.positive_measure_id,item.tested_measure_id].filter((id):id is string=>id!==null) : [];
    requested.push(...measureIds.map(id=>({collection:"metrics.measures" as const,id})));
    const assertionIds=new Set(item.comparison_ids.flatMap(id=>bundle.comparisons.find(comparison=>comparison.id===id)!.participant_ids));
    requested.push(...[...assertionIds].map(id=>({collection:"assertions" as const,id})));
    return requested;
  },[item,bundle.comparisons]);
  const {data,error,retry}=useAtlasDetails(refs);
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  const fields=isSampling(item) ? {"Sample unit":item.unit,"Sampling frame":item.frame,"Population":item.population,"Target":item.target,"Method":item.method,"Pooling":item.pooling,"Clustering":item.clustering,"Repeat sampling":item.repeated_sampling} : isContext(item) ? {"Variable":item.variable,"Method":item.method} : {};
  const values=isContext(item) ? item.measure_ids.map(id=>data.get("metrics.measures",id)) : isSampling(item) ? [item.positive_measure_id,item.tested_measure_id].filter((id):id is string=>id!==null).map(id=>data.get("metrics.measures",id)) : [];
  const places=isContext(item)?bundle.places.filter(p=>item.place_ids.includes(p.id)):[];
  const documents=[...new Set(item.record_ids.map(id=>bundle.records.find(r=>r.id===id)!.document_id))].map(id=>atlasDocuments.get(id)!);
  return <><header><div className="atlas-oh-detail-top"><span className="atlas-oh-detail-kind">{kind(item)}</span><button onClick={()=>onReport(item.record_ids,true)}><FileText size={13} aria-hidden />View reports<ArrowRight size={12} aria-hidden /></button></div><h3>{title(item,nodes)}</h3></header>
    {item.contested && <p className="atlas-status" data-tone="warning">Contested proposition</p>}
    <dl className="atlas-oh-time-facts"><div><dt><CalendarDays size={13} aria-hidden />Source time</dt><dd>{observationTimeLabel(item.time)}</dd></div><div><dt>Date kind</dt><dd>{words(item.time.kind)}</dd></div><div><dt>Time extent</dt><dd>{words(item.time.extent)}</dd></div><div><dt>Precision</dt><dd>{item.time.precision}</dd></div><div><dt>Certainty</dt><dd>{item.time.certainty}</dd></div></dl><section className="atlas-oh-detail-note"><h4>Date context</h4><p>{item.time.label}</p><p>{item.time.reason}</p></section>
    {isSampling(item) && <p className="atlas-oh-note">{words(item.pair_status)} pair · {item.display_reason}</p>}
    <dl>{Object.entries(fields).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value.value ?? words(value.status)}</dd></div>)}</dl>
    {isContext(item) && <><p>{item.linkage_note}</p>{!item.node_ids.length && <p>Independent source statement; no linked observation is asserted.</p>}<LocationBadges codes={[...new Set(places.flatMap(p=>p.area_codes))]} />{places.map(p=><p key={p.id}>{p.label} · {words(p.precision)}</p>)}</>}
    {values.map(m=><article className="atlas-oh-measure" key={m.measure_id}><strong>{metricValue(m)} <small>{words(m.unit)}</small></strong><b>{m.label}</b><span>{m.population.value ?? words(m.population.status)}</span><span>{m.period_label}</span><p>{m.semantic_note}</p></article>)}
    <section className="atlas-oh-detail-note"><h4>Review scope</h4><p>{item.reason}</p><p>{words(item.review_state)} · reviewed {formatDate(item.reviewed_at)}</p></section>
    <details className="atlas-oh-methods"><summary><CalendarDays size={14} aria-hidden />Publication & capture dates<ChevronDown size={14} aria-hidden /></summary>{documents.map(d=><p key={d.id}>{englishTitle(d)}<small>Published {formatDate(d.publication)} · Captured {formatDate(d.capture)}</small></p>)}</details>
    {item.comparison_ids.map(id=>{const c=bundle.comparisons.find(c=>c.id===id)!;return <details key={id}><summary>{words(c.kind)} · comparison evidence</summary>{c.participant_ids.map(id=><p key={id}>{data.get("assertions",id).text}</p>)}</details>;})}
    <h4><FileText size={14} aria-hidden />Source evidence</h4>{item.evidence_ids.map(id=>{const e=data.get("evidence",id),d=atlasDocuments.get(e.document_id)!;return <div className="atlas-oh-source" key={id}><a href={d.url} target="_blank" rel="noopener noreferrer">{englishTitle(d)}<ExternalLink size={12} aria-hidden /></a><small>Published {formatDate(d.publication)}{e.page!==null?` · Page ${e.page}`:""}{e.section?` · ${e.section}`:""}</small><SourceQuotation quote={e.quote} evidenceId={e.id} /></div>;})}
  </>;
}
