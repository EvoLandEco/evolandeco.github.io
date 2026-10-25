"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { packSiblings } from 'd3-hierarchy';
import { landscapeRivers, sharedLabels, sourceSupport, unique, pairKey, type EvidenceLandscape, type LandscapeBundle, type LandscapeGroup, type LandscapeSelection } from '@/lib/atlas-evidence-landscape';
import styles from './atlas-evidence-landscape.module.css';
import { useElementSize } from './use-element-size';

type Common = { data: EvidenceLandscape; onInspect: (selection: LandscapeSelection)=>void };
const count = (n:number)=>n.toLocaleString('en-GB');
const monthLabel = (month:string)=>new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'short',timeZone:'UTC'});
const color = (id:number)=>id===0?'var(--muted-foreground)':id%4===0?'color-mix(in srgb, var(--atlas-green) 65%, var(--primary))':id%4===1?'var(--primary)':id%4===2?'var(--atlas-green)':'color-mix(in srgb, var(--primary) 55%, var(--atlas-green))';
const groupName = (g:LandscapeGroup)=>g.identity?`Group ${g.identity}`:'Unconnected labels';
const short = (text:string,length=30)=>text.length>length?`${text.slice(0,length-1)}…`:text;
const enter = (action:()=>void)=>(event:KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();action();}};
function useWidth() {
  const ref=useRef<HTMLDivElement>(null); const [width,setWidth]=useState(600);
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>setWidth(Math.max(280,Math.round(entry.contentRect.width))));observer.observe(ref.current!);return()=>observer.disconnect();},[]);
  return {ref,width};
}
function GroupSummary({group,onInspect}:{data:EvidenceLandscape;group:LandscapeGroup;onInspect:Common['onInspect']}) {
  return <button className={styles.textAction} onClick={()=>onInspect({title:groupName(group),labels:group.labels,documents:group.documents})}>{groupName(group)} · {group.labels.length} labels <ArrowRight size={12}/></button>;
}

export function BundleFigure({data,bundle,onInspect,onBundle}:Common & {bundle:LandscapeBundle;onBundle:(id:string)=>void}) {
  const {ref,width}=useWidth();
  const related=data.bundles.filter(b=>b.id!==bundle.id&&sharedLabels(b.labels,bundle.labels).length).sort((a,b)=>sharedLabels(b.labels,bundle.labels).length-sharedLabels(a.labels,bundle.labels).length||b.documents.length-a.documents.length);
  const visible=[bundle,...related.slice(0,7)];
  const labels=unique(visible.flatMap(b=>b.labels)).sort((a,b)=>Number(bundle.labels.includes(b))-Number(bundle.labels.includes(a))||data.labels[a].name.localeCompare(data.labels[b].name));
  const height=Math.max(300,labels.length*26+30), left=width<450?Math.min(150,width*.45):Math.min(240,width*.45),right=width-50;
  const y=(i:number,total:number)=>(height-48)*(i+.5)/total+24;
  return <div ref={ref} className={styles.figure}>

    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Observed reporting bundles and disease membership">
      {visible.flatMap((b,j)=>b.labels.map(id=>{const yi=y(labels.indexOf(id),labels.length),yj=y(j,visible.length);return <path key={`${b.id}:${id}`} d={`M${left},${yi} C${left+(right-left)*.5},${yi} ${left+(right-left)*.5},${yj} ${right},${yj}`} fill="none" stroke={b.id===bundle.id?'var(--atlas-green)':'var(--primary)'} strokeWidth={b.id===bundle.id?1.7:1} opacity={b.id===bundle.id?.65:.15}/>;}))}
      {labels.map((id,i)=>{const docs=unique(data.bundles.filter(b=>b.labels.includes(id)).flatMap(b=>b.documents));const action=()=>onInspect({title:data.labels[id].name,labels:[id],documents:docs});return <g key={id} role="button" tabIndex={0} aria-label={`Inspect ${data.labels[id].name}`} className={styles.svgButton} onClick={action} onKeyDown={enter(action)}><title>{data.labels[id].name}</title><rect x={0} y={y(i,labels.length)-12} width={left+10} height={24} fill="transparent"/><circle cx={left} cy={y(i,labels.length)} r={bundle.labels.includes(id)?4.5:3} fill={bundle.labels.includes(id)?'var(--atlas-green)':'var(--primary)'}/><text x={left-12} y={y(i,labels.length)+4} textAnchor="end">{short(data.labels[id].name,Math.floor(left/6.5))}</text></g>;})}
      {visible.map((b,j)=>{const action=()=>{onBundle(b.id);onInspect({title:b.labels.map(i=>data.labels[i].name).join(' + '),labels:b.labels,documents:b.documents,records:b.records,note:`${b.records.length} report entries`});};return <g key={b.id} role="button" tabIndex={0} aria-label={`Bundle ${j+1}, ${b.labels.map(i=>data.labels[i].name).join(', ')}, ${b.documents.length} documents`} className={styles.svgButton} onClick={action} onKeyDown={enter(action)}><rect x={right-16} y={y(j,visible.length)-16} width={60} height={32} rx={8} fill={b.id===bundle.id?'var(--atlas-green)':'var(--primary)'} fillOpacity={b.id===bundle.id?.12:.04}/><rect x={right-5} y={y(j,visible.length)-5} width={10} height={10} rx={2} fill={b.id===bundle.id?'var(--atlas-green)':'var(--primary)'}/><text x={right+13} y={y(j,visible.length)+4}>{b.documents.length}</text></g>;})}
    </svg>
    <div className={styles.legend}><span><i/>Diseases</span><span><i data-square/>Bundles · documents</span></div>
  </div>;
}

export function IslandFigure({data,month,onInspect}:Common & {month:EvidenceLandscape['months'][number]}) {
  const {ref,width}=useWidth(); const [expanded,setExpanded]=useState<string|null>(null);
  const active=month.groups.find(g=>g.id===expanded);
  const groups=month.groups.filter(g=>g.identity);
  const edgeMap=useMemo(()=>new Map(month.edges.map(([a,b,w])=>[pairKey(a,b),w])),[month]);
  const maximum=Math.max(...month.edges.map(e=>e[2]),1);
  const packed=useMemo(()=>{const nodes=month.groups.filter(g=>g.identity).map(g=>({r:24+Math.sqrt(g.labels.length)*6,x:0,y:0,g}));packSiblings(nodes);return nodes;},[month]);
  const x0=Math.min(...packed.map(n=>n.x-n.r)),x1=Math.max(...packed.map(n=>n.x+n.r)),y0=Math.min(...packed.map(n=>n.y-n.r)),y1=Math.max(...packed.map(n=>n.y+n.r));
  const scale=Math.min((width-30)/(x1-x0),330/(y1-y0)),height=Math.max(280,(y1-y0)*scale+60);
  const locations=new Map(packed.map(n=>[n.g.id,{x:(n.x-(x0+x1)/2)*scale+width/2,y:(n.y-y0)*scale+25,r:n.r*scale}]));
  const inspect=(g:LandscapeGroup)=>onInspect({title:`${monthLabel(month.month)} · ${groupName(g)}`,labels:g.labels,documents:g.documents});
  const pairs=groups.flatMap((g,i)=>groups.slice(i+1).map(h=>({a:g,b:h,weight:month.edges.filter(([a,b])=>g.labels.includes(a)&&h.labels.includes(b)||g.labels.includes(b)&&h.labels.includes(a)).reduce((s,e)=>s+e[2],0)}))).filter(p=>p.weight>0);
  return <div ref={ref} className={styles.figure}>

    {active?<><button className={styles.textAction} onClick={()=>setExpanded(null)}><ArrowLeft size={13}/>All islands</button><h4>{groupName(active)}</h4>
      <Adjacency data={data} labels={active.labels} value={(a,b)=>edgeMap.get(pairKey(a,b))??0} max={maximum} onPair={(a,b)=>onInspect({title:`${data.labels[a].name} + ${data.labels[b].name}`,labels:[a,b],documents:unique(data.bundles.filter(g=>g.labels.includes(a)&&g.labels.includes(b)).flatMap(g=>g.documents)).filter(i=>data.documents[i].date.startsWith(month.month))})}/>
    </>:<><svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Reporting community matrix islands">
      {pairs.map(p=>{const a=locations.get(p.a.id)!,b=locations.get(p.b.id)!;return <line key={`${p.a.id}:${p.b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--atlas-green)" strokeWidth={1+Math.log1p(p.weight)} opacity={.25}/>;})}
      {groups.map(g=>{const p=locations.get(g.id)!,side=p.r*1.3,cell=side/g.labels.length,action=()=>{setExpanded(g.id);inspect(g);};return <g key={g.id} role="button" tabIndex={0} aria-label={`Expand ${groupName(g)}, ${g.labels.length} labels`} className={styles.svgButton} onClick={action} onKeyDown={enter(action)}><rect x={p.x-side/2-7} y={p.y-side/2-7} width={side+14} height={side+14} rx={10} fill={color(g.identity)} fillOpacity={.055}/>{g.labels.flatMap((a,i)=>g.labels.map((b,j)=>{const v=i===j?0:edgeMap.get(pairKey(a,b))??0;return <rect key={`${a}:${b}`} x={p.x-side/2+j*cell} y={p.y-side/2+i*cell} width={Math.max(.5,cell-.4)} height={Math.max(.5,cell-.4)} fill={color(g.identity)} fillOpacity={i===j?.12:v?.25+.7*Math.sqrt(v/maximum):.025}/>;}))}<text x={p.x} y={p.y+side/2+21} textAnchor="middle">G{g.identity} · {g.labels.length}</text></g>;})}
    </svg><div className={styles.legend}><span>Within-group matrices</span><span>Between-group links</span></div>
    <div className={styles.groupList}>{month.groups.map(g=><GroupSummary key={g.id} data={data} group={g} onInspect={onInspect}/>)}</div></>}
  </div>;
}

function Adjacency({data,labels,value,max,onPair,kind}:{data:EvidenceLandscape;labels:number[];value:(a:number,b:number)=>number;max:number;onPair:(a:number,b:number)=>void;kind?:'units'}) {
  const {ref,width}=useWidth(); const size=Math.max(240,Math.min(width-24,500)),cell=size/labels.length;
  return <div ref={ref}><svg width="100%" height={size+32} viewBox={`0 0 ${width} ${size+32}`} role="group" aria-label={kind==='units'?'Entry and document co-reporting matrix':'Within-group weighted adjacency matrix'}>
    {labels.map((id,i)=><text key={id} x={24+i*cell+cell/2} y={14} textAnchor="middle">{cell>=17?i+1:''}</text>)}
    {labels.flatMap((a,i)=>labels.map((b,j)=>{const v=i===j?0:value(a,b),action=()=>onPair(a,b);return <g key={`${a}:${b}`} role={v?'button':undefined} tabIndex={v?0:undefined} aria-label={v?`${data.labels[a].name} and ${data.labels[b].name}: ${kind==='units'?(v===2?'same-entry support':'document-only support'):`weight ${v.toFixed(3)}`}`:undefined} className={styles.svgButton} onClick={v?action:undefined} onKeyDown={v?enter(action):undefined}><rect x={24+j*cell} y={24+i*cell} width={Math.max(.5,cell-1)} height={Math.max(.5,cell-1)} rx={cell>12?2:0} fill={kind==='units'&&v===1?'var(--atlas-coral)':'var(--atlas-green)'} fillOpacity={i===j?.12:v?kind==='units'?.65:.15+.8*Math.sqrt(v/max):.035}/></g>;}))}
    {labels.map((id,i)=><text key={id} x={15} y={24+i*cell+cell/2+4} textAnchor="end">{cell>=17?i+1:''}</text>)}
  </svg><ol className={styles.labelRoster}>{labels.map(id=><li key={id}>{data.labels[id].name}</li>)}</ol><details className={styles.disclosure}><summary>Connection table</summary><table className={styles.table}><thead><tr><th>Pair</th><th>{kind==='units'?'Support':'Weight'}</th></tr></thead><tbody>{labels.flatMap((a,i)=>labels.slice(i+1).map(b=>({a,b,v:value(a,b)}))).filter(p=>p.v>0).map(({a,b,v})=><tr key={pairKey(a,b)}><th><button onClick={()=>onPair(a,b)}>{data.labels[a].name} + {data.labels[b].name}</button></th><td>{kind==='units'?(v===2?'Same entry':'Document only'):v.toFixed(3)}</td></tr>)}</tbody></table></details></div>;
}

export function SourceFigure({data,source,onSource,onInspect}:Common & {source:number;onSource:(source:number)=>void}) {
  const {ref,width}=useWidth(); const rows=[...data.removals].sort((a,b)=>b.document_pairs_lost-a.document_pairs_lost);
  const allEntry=data.pairs.filter(p=>p.entry_documents.length).length;
  const selected=data.removals.find(r=>r.source===source)!;
  const left=Math.min(width*.43,225),right=width-28,chartWidth=right-left,height=rows.length*42+35;
  const inspect=(id:number)=>{onSource(id);const documents=data.documents.map((d,i)=>d.source===id?i:-1).filter(i=>i>=0);onInspect({title:`Removed source · ${data.sources[id].name}`,labels:unique(documents.flatMap(i=>data.documents[i].labels)),documents});};
  return <div ref={ref} className={styles.figure}>
    <div className={styles.measureLine}><strong>{count(selected.document_pairs_lost)} / {count(data.pairs.length)}</strong><span>document pairs lost</span><strong>{selected.bundles_lost} / {data.bundles.length}</strong><span>bundles lost</span></div>
    <div className={styles.legend}><span><i/>Same-entry pairs</span><span><i data-blue data-square/>Document pairs</span></div>
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Pair loss after removing each source">
      {[0,.5,1].map(t=><g key={t}><line x1={left+t*chartWidth} x2={left+t*chartWidth} y1={23} y2={height-10} stroke="var(--border)" strokeOpacity={.5}/><text x={left+t*chartWidth} y={14} textAnchor="middle">{t*100}%</text></g>)}
      {rows.map((r,i)=>{const y=42+i*42,a=r.entry_pairs_lost/allEntry,b=r.document_pairs_lost/data.pairs.length,action=()=>inspect(r.source);return <g key={r.source} role="button" tabIndex={0} aria-label={`${data.sources[r.source].name}: ${r.entry_pairs_lost} entry pairs and ${r.document_pairs_lost} document pairs lost`} onClick={action} onKeyDown={enter(action)} className={styles.svgButton}><rect x={0} y={y-17} width={width} height={35} rx={6} fill="var(--primary)" fillOpacity={r.source===source?.07:0}/><text x={left-12} y={y+4} textAnchor="end">{short(data.sources[r.source].name,Math.floor(left/6.4))}</text><line x1={left+a*chartWidth} x2={left+b*chartWidth} y1={y} y2={y} stroke="var(--muted-foreground)" opacity={.35} strokeWidth={2}/><circle cx={left+a*chartWidth} cy={y} r={4} fill="var(--atlas-green)"/><rect x={left+b*chartWidth-3.5} y={y-3.5} width={7} height={7} rx={1} fill="var(--primary)"/></g>;})}
    </svg>
    <div className={styles.bundleLoss}>{data.bundles.filter(b=>b.documents.some(i=>data.documents[i].source===source)).map(b=>{const remaining=b.documents.filter(i=>data.documents[i].source!==source).length;return <button key={b.id} data-lost={!remaining||undefined} onClick={()=>onInspect({title:b.labels.map(i=>data.labels[i].name).join(' + '),labels:b.labels,documents:b.documents,records:b.records,note:`${remaining} of ${b.documents.length} documents survive source removal`})}><span>{b.labels.map(i=>data.labels[i].name).join(' + ')}</span><strong>{b.documents.length} → {remaining}</strong></button>;})}</div>
  </div>;
}

export function UnitFigure({data,disease,onInspect}:Common & {disease:number}) {
  const shared=data.pairs.filter(p=>p.entry_documents.length).length;
  const neighbors=data.pairs.filter(p=>p.labels.includes(disease)).sort((a,b)=>b.documents.length-a.documents.length);
  const labels=[disease,...unique(neighbors.flatMap(p=>p.labels)).filter(id=>id!==disease).slice(0,19)];
  const pairs=new Map(data.pairs.map(p=>[pairKey(...p.labels),p]));
  return <div className={styles.figure}>
    <div className={styles.unitBar} role="img" aria-label={`${shared} same-entry pairs, ${data.pairs.length-shared} document-only pairs`}><span style={{flex:shared}}>{count(shared)}</span><span style={{flex:data.pairs.length-shared}}>{count(data.pairs.length-shared)}</span></div>
    <div className={styles.legend}><span><i/>Same entry</span><span><i data-coral/>Document only</span></div>

    {neighbors.length?<Adjacency data={data} labels={labels} kind="units" max={2} value={(a,b)=>{const p=pairs.get(pairKey(a,b));return p?p.entry_documents.length?2:1:0;}} onPair={(a,b)=>{const p=pairs.get(pairKey(a,b))!;onInspect({title:`${data.labels[a].name} + ${data.labels[b].name}`,labels:[a,b],documents:p.documents,note:`${p.entry_documents.length} of ${p.documents.length} documents contain same-entry support`});}}/>:<p className={styles.empty}>No shared documents.</p>}
    <details className={styles.disclosure}><summary>All {neighbors.length} connections for this label</summary><table className={styles.table}><thead><tr><th>Other label</th><th>Same entry</th><th>Same document</th></tr></thead><tbody>{neighbors.map(p=>{const other=p.labels.find(id=>id!==disease)!;return <tr key={other}><th><button onClick={()=>onInspect({title:`${data.labels[disease].name} + ${data.labels[other].name}`,labels:p.labels,documents:p.documents,note:`${p.entry_documents.length} same-entry documents`})}>{data.labels[other].name}</button></th><td>{p.entry_documents.length}</td><td>{p.documents.length}</td></tr>;})}</tbody></table></details>
  </div>;
}

export function PersistenceFigure({data,bundle,onInspect}:Common & {bundle:LandscapeBundle}) {
  const months=unique(data.documents.map(d=>d.date.slice(0,7))).sort();
  const sources=sourceSupport(data,bundle.documents);
  const cells=sources.map(s=>months.map(m=>{const documents=bundle.documents.filter(i=>data.documents[i].source===s.source&&data.documents[i].date.startsWith(m));const denominator=data.documents.filter(d=>d.source===s.source&&d.date.startsWith(m)).length;return {documents,denominator};}));
  const active=months.filter((_,j)=>cells.some(row=>row[j].documents.length)).length;
  const maximum=Math.max(...cells.flatMap(row=>row.map(c=>c.documents.length)),1);
  return <div className={styles.figure}>
    <div className={styles.measureLine}><strong>{active} / {months.length}</strong><span>publication months</span><strong>{bundle.documents.length}</strong><span>supporting documents</span></div>
    <div className={styles.rasterScroll}><table className={styles.raster}><caption className="sr-only">Monthly bundle support by exported organization ID</caption><thead><tr><th>Source</th>{months.map(m=><th key={m}>{monthLabel(m)}<small>{m.slice(0,4)}</small></th>)}</tr></thead><tbody>{sources.map((s,i)=><tr key={s.source}><th>{data.sources[s.source].name}</th>{cells[i].map((cell,j)=><td key={months[j]}><button disabled={!cell.documents.length} style={{'--cell-strength':cell.documents.length/maximum} as CSSProperties} aria-label={`${data.sources[s.source].name}, ${months[j]}: ${cell.documents.length} of ${cell.denominator} documents contain this exact bundle`} onClick={()=>onInspect({title:`${monthLabel(months[j])} · ${data.sources[s.source].name}`,labels:bundle.labels,documents:cell.documents,records:bundle.records,note:`${cell.documents.length} of ${cell.denominator} source/month documents contain this bundle`})}>{cell.documents.length||'–'}<small>/{cell.denominator}</small></button></td>)}</tr>)}</tbody></table></div>

    <div className={styles.persistenceList}>{sources.map(s=>{const docs=bundle.documents.filter(i=>data.documents[i].source===s.source);const dates=docs.map(i=>data.documents[i].date).sort();return <button key={s.source} onClick={()=>onInspect({title:data.sources[s.source].name,labels:bundle.labels,documents:docs})}><span>{data.sources[s.source].name}</span><strong>{s.count} documents</strong><small>{dates[0]} → {dates.at(-1)}</small></button>;})}</div>
  </div>;
}

export function RiverFigure({data,disease,onInspect}:Common & {disease:number}) {
  const {ref,size}=useElementSize<HTMLDivElement>(); const links=useMemo(()=>landscapeRivers(data.months),[data]);
  const width=size?.width??600,height=Math.max(280,size?.height??400),top=45,bottom=24,gap=6,block=8,margin=18,step=(width-2*margin-block)/(data.months.length-1);
  const unit=Math.min(...data.months.map(m=>(height-top-bottom-gap*(m.groups.length-1))/m.groups.reduce((s,g)=>s+g.labels.length,0)));
  const nodes=new Map<string,LandscapeGroup&{x:number;y:number;h:number;month:number}>();
  data.months.forEach((m,i)=>{const total=m.groups.reduce((s,g)=>s+g.labels.length,0)*unit+(m.groups.length-1)*gap;let y=top+(height-top-bottom-total)/2;m.groups.forEach(g=>{nodes.set(g.id,{...g,x:margin+i*step,y,h:g.labels.length*unit,month:i});y+=g.labels.length*unit+gap;});});
  const incoming=new Map<string,number>(),outgoing=new Map<string,number>();
  const ribbons=links.map(l=>({...l,sy:0,ty:0}));
  ribbons.sort((a,b)=>nodes.get(a.target)!.y-nodes.get(b.target)!.y).forEach(l=>{const n=nodes.get(l.source)!;l.sy=n.y+(outgoing.get(n.id)??0);outgoing.set(n.id,(outgoing.get(n.id)??0)+l.labels.length*unit);});
  ribbons.sort((a,b)=>nodes.get(a.source)!.y-nodes.get(b.source)!.y).forEach(l=>{const n=nodes.get(l.target)!;l.ty=n.y+(incoming.get(n.id)??0);incoming.set(n.id,(incoming.get(n.id)??0)+l.labels.length*unit);});
  const selected=disease>=0;
  const path=(l:typeof ribbons[number])=>{const a=nodes.get(l.source)!,b=nodes.get(l.target)!,x=a.x+block,z=b.x,mid=(x+z)/2,h=l.labels.length*unit;return `M${x},${l.sy}C${mid},${l.sy} ${mid},${l.ty} ${z},${l.ty}L${z},${l.ty+h}C${mid},${l.ty+h} ${mid},${l.sy+h} ${x},${l.sy+h}Z`;};
  return <div className={`${styles.figure} ${styles.riverFigure}`}>

    <div className={styles.legend}><span><i/>Reporting groups</span><span><i data-grey/>Unconnected labels</span></div>
    <div ref={ref} className={styles.riverPlot}><svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Temporal reporting community rivers">
      {data.months.map((m,i)=><g key={m.month}><text x={margin+i*step+block/2} y={16} textAnchor="middle">{monthLabel(m.month)}</text><text className={styles.secondary} x={margin+i*step+block/2} y={33} textAnchor="middle">{m.groups.reduce((n,g)=>n+g.labels.length,0)}</text></g>)}
      {ribbons.map(l=>{const a=nodes.get(l.source)!,b=nodes.get(l.target)!,action=()=>onInspect({title:`${monthLabel(data.months[a.month].month)} → ${monthLabel(data.months[b.month].month)} · ${l.labels.length} shared labels`,labels:l.labels,documents:unique([...a.documents,...b.documents]).filter(i=>data.documents[i].labels.some(id=>l.labels.includes(id))),note:`${groupName(a)} → ${groupName(b)}`});return <path key={`${l.source}:${l.target}`} d={path(l)} fill={color(a.identity)} fillOpacity={selected?(l.labels.includes(disease)?.75:.07):a.identity?.36:.16} role="button" tabIndex={0} className={styles.svgButton} aria-label={`${monthLabel(data.months[a.month].month)} to ${monthLabel(data.months[b.month].month)}, ${l.labels.length} shared labels`} onClick={action} onKeyDown={enter(action)}/>;})}
      {[...nodes.values()].map(n=>{const action=()=>onInspect({title:`${monthLabel(data.months[n.month].month)} · ${groupName(n)}`,labels:n.labels,documents:n.documents});const inc=incoming.get(n.id)??0,out=outgoing.get(n.id)??0;return <g key={n.id}>{n.month>0&&n.h-inc>.01&&<rect x={n.x-7} y={n.y+inc} width={7} height={n.h-inc} fill="var(--muted-foreground)" opacity={.17}/>} {n.month<data.months.length-1&&n.h-out>.01&&<rect x={n.x+block} y={n.y+out} width={7} height={n.h-out} fill="var(--muted-foreground)" opacity={.17}/>}<rect role="button" tabIndex={0} aria-label={`${monthLabel(data.months[n.month].month)} ${groupName(n)}, ${n.labels.length} labels`} className={styles.svgButton} x={n.x} y={n.y} width={block} height={n.h} rx={1.5} fill={color(n.identity)} opacity={!selected||n.labels.includes(disease)?.9:.2} onClick={action} onKeyDown={enter(action)}/>{n.h>=18&&width>540&&n.identity>0&&<text x={n.x+(n.month===9?-4:12)} y={n.y+n.h/2+4} textAnchor={n.month===9?'end':'start'} pointerEvents="none">G{n.identity}</text>}</g>;})}
    </svg></div>
    {selected&&<div className={styles.groupList}>{data.months.map(m=>{const g=m.groups.find(g=>g.labels.includes(disease));return <button key={m.month} disabled={!g} onClick={()=>g&&onInspect({title:`${monthLabel(m.month)} · ${data.labels[disease].name}`,labels:g.labels,documents:g.documents,note:groupName(g)})}><span>{monthLabel(m.month)}</span><strong>{g?g.identity?`G${g.identity}`:'Unconnected':'Not reported'}</strong></button>;})}</div>}
  </div>;
}

export function NullFigure({data,onInspect}:Common) {
  const {ref,width}=useWidth();const rows=data.null_model.pairs;
  const left=Math.min(width*.44,245),right=width-30,max=Math.max(...rows.flatMap(p=>[p.observed,p.global[2],p.conditional[2]]))*1.06;
  const x=(v:number)=>left+(right-left)*v/max,height=rows.length*62+48;
  return <div ref={ref} className={styles.figure}>
    <div className={styles.legend}><span><i data-blue/>Global</span><span><i/>Source × month</span><span><i data-outline/>Observed documents</span></div>
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Observed pair overlap against randomized reporting matrices">
      {[0,.5,1].map(t=><g key={t}><line x1={x(t*max)} x2={x(t*max)} y1={26} y2={height-8} stroke="var(--border)" strokeOpacity={.5}/><text x={x(t*max)} y={16} textAnchor="middle">{Math.round(t*max)}</text></g>)}
      {rows.map((p,i)=>{const y=46+i*62,action=()=>onInspect({title:p.labels.map(id=>data.labels[id].name).join(' + '),labels:p.labels,documents:data.pairs.find(pair=>pairKey(...pair.labels)===pairKey(...p.labels))!.documents,note:`Observed ${p.observed}; global mean ${p.global[1].toFixed(1)} (95% draw range ${p.global[0]}–${p.global[2]}); source/month mean ${p.conditional[1].toFixed(1)} (range ${p.conditional[0]}–${p.conditional[2]})`});return <g key={p.labels.join(':')} role="button" tabIndex={0} aria-label={`${p.labels.map(id=>data.labels[id].name).join(' and ')}: ${p.observed} observed documents`} className={styles.svgButton} onClick={action} onKeyDown={enter(action)}><rect x={0} y={y-20} width={width} height={54} fill="transparent"/><text x={left-12} y={y-2} textAnchor="end">{short(data.labels[p.labels[0]].name,Math.floor(left/6.7))}</text><text x={left-12} y={y+15} textAnchor="end">{short(data.labels[p.labels[1]].name,Math.floor(left/6.7))}</text>{([p.global,p.conditional] as const).map((range,j)=><g key={j}><line x1={x(range[0])} x2={x(range[2])} y1={y+j*14} y2={y+j*14} stroke={j?'var(--atlas-green)':'var(--primary)'} strokeWidth={5} strokeLinecap="round" opacity={.35}/><circle cx={x(range[1])} cy={y+j*14} r={3} fill={j?'var(--atlas-green)':'var(--primary)'}/></g>)}<circle cx={x(p.observed)} cy={y+7} r={4.5} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5}/></g>;})}
    </svg>
  </div>;
}
