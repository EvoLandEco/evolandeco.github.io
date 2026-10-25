"use client";
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ArrowRight, BookOpen, ExternalLink, Layers3 } from 'lucide-react';
import { fetchEvidenceLandscape, sourceSupport, unique, type EvidenceLandscape, type LandscapeSelection } from '@/lib/atlas-evidence-landscape';
import { formatDate } from '@/lib/atlas';
import { AtlasSelect } from './atlas-select';
import { AtlasScope } from './atlas-scope';
import { useAtlas, useAtlasPanelState } from './atlas-context';
import { BundleFigure, IslandFigure, SourceFigure, UnitFigure, PersistenceFigure, RiverFigure, NullFigure } from './atlas-landscape-figures';
import { ReportNeighbourFigure, SourceAffinityFigure, ThemeRoleFigure } from './atlas-landscape-bibliometrics';
import styles from './atlas-evidence-landscape.module.css';

const views = [
  { id: 'bundles', label: 'Observed bundles' },
  { id: 'islands', label: 'Matrix islands' },
  { id: 'sources', label: 'Source dependence' },
  { id: 'units', label: 'Reporting units' },
  { id: 'persistence', label: 'Publication persistence' },
  { id: 'rivers', label: 'Community rivers' },
  { id: 'nulls', label: 'Null comparisons' },
  { id: 'neighbours', label: 'Report neighbours' },
  { id: 'affinities', label: 'Source affinities' },
  { id: 'roles', label: 'Theme roles' },
] as const;

type LandscapeControls = { viewSelector: ReactNode; footerTarget: HTMLElement | null };

export function AtlasEvidenceLandscape({ exportId, onReport, viewSelector, footerTarget }: LandscapeControls & { exportId: string; onReport: (ids: string[], expand?: boolean) => void }) {
  const [data,setData] = useState<EvidenceLandscape>();
  const [error,setError] = useState('');
  const [attempt,setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetchEvidenceLandscape(exportId, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Evidence landscape could not be loaded.'); });
    return () => controller.abort();
  },[exportId,attempt]);
  if (error) return <p className={styles.notice} role="alert">{error} <button onClick={() => { setError(''); setAttempt(n=>n+1); }}>Retry</button></p>;
  if (!data) return <div className="atlas-panel-loading" role="status"><div className="atlas-panel-loading-content"><span className="atlas-panel-loading-mark"><Layers3 size={30}/></span><strong>Loading Evidence landscape</strong></div></div>;
  return <Landscape key={data.export_id} data={data} onReport={onReport} viewSelector={viewSelector} footerTarget={footerTarget}/>;
}

function Landscape({ data,onReport,viewSelector,footerTarget }: LandscapeControls & { data: EvidenceLandscape; onReport: (ids:string[],expand?:boolean)=>void }) {
  const { atlasDocuments, englishTitle } = useAtlas();
  const [view,setView] = useAtlasPanelState('landscape.view','bundles');
  const [bundleId,setBundleId] = useAtlasPanelState('landscape.bundle',data.bundles[0].id);
  const [source,setSource] = useAtlasPanelState('landscape.source',String([...data.removals].sort((a,b)=>b.document_pairs_lost-a.document_pairs_lost)[0].source));
  const [month,setMonth] = useAtlasPanelState('landscape.month',data.months.at(-1)!.month);
  const [disease,setDisease] = useAtlasPanelState('landscape.unitDisease',String(data.labels.findIndex(d=>d.id==='disease:influenza')));
  const [riverDisease,setRiverDisease] = useAtlasPanelState('landscape.riverDisease',String(data.labels.findIndex(d=>d.id==='disease:influenza')));
  const [documentId,setDocumentId] = useAtlasPanelState('landscape.document',String(data.documents.map((d,i)=>({d,i})).filter(({d})=>d.labels.length>1).sort((a,b)=>b.d.date.localeCompare(a.d.date))[0].i));
  const [affinitySource,setAffinitySource] = useAtlasPanelState('landscape.affinitySource',String([...data.removals].sort((a,b)=>b.documents-a.documents)[0].source));
  const [selection,setSelection] = useState<LandscapeSelection>();
  const current = views.findIndex(v=>v.id===view);
  const bundle = data.bundles.find(b=>b.id===bundleId)!;
  const label = (ids:number[])=>ids.map(i=>data.labels[i].name).join(' + ');
  const bundleItems = useMemo(()=>data.bundles.map(b=>({value:b.id,label:b.labels.map(i=>data.labels[i].name).join(' + '),badges:[{kind:'count' as const,label:`${b.documents.length} documents`},{kind:'disease' as const,label:`${b.labels.length} labels`}]})),[data]);
  const documentItems = useMemo(()=>data.documents.map((d,i)=>({value:String(i),label:atlasDocuments.has(d.id)?englishTitle(atlasDocuments.get(d.id)!):d.title,searchText:`${d.date} ${data.sources[d.source].name}`,badges:[{kind:'count' as const,label:formatDate(d.date)},{kind:'disease' as const,label:`${d.labels.length} labels`}]})).sort((a,b)=>data.documents[Number(b.value)].date.localeCompare(data.documents[Number(a.value)].date)),[data,atlasDocuments,englishTitle]);
  const defaultSelection: LandscapeSelection = {title:label(bundle.labels),labels:bundle.labels,documents:bundle.documents,records:bundle.records,note:`${bundle.records.length} report entries`};
  function changeView(id:string) { setView(id); setSelection(undefined); }
  function changeBundle(id:string) { setBundleId(id); setSelection(undefined); }
  const monthIndex=data.months.findIndex(m=>m.month===month);
  const common={data,onInspect:setSelection};
  const inspected = selection ?? (['bundles','persistence'].includes(view)?defaultSelection:undefined);
  return <div className={styles.landscape} data-landscape-view={view} data-inspecting={!!inspected || undefined}>
    {footerTarget && createPortal(<div className="atlas-view-about"><AtlasScope buttonLabel="About Evidence landscape" label="Methods & references" title="Evidence landscape"><LandscapeMethods data={data}/></AtlasScope></div>,footerTarget)}
    <header className={`${styles.toolbar} atlas-entry-tools atlas-panel-tools`} data-controls={view!=='nulls' || undefined}>
      {viewSelector}
      <AtlasSelect label="Landscape view" value={view} onChange={changeView} items={views.map(v=>({value:v.id,label:v.label}))}/>
    <div className={styles.tools}>
      {['bundles','persistence'].includes(view) && <AtlasSelect label="Reporting bundle" searchable value={bundleId} onChange={changeBundle} items={bundleItems}/>}
      {view==='sources' && <AtlasSelect label="Source to remove" searchable value={source} onChange={value=>{setSource(value);setSelection(undefined);}} items={data.sources.map((s,i)=>({value:String(i),label:s.name,badges:[{kind:'count',label:`${data.removals.find(r=>r.source===i)!.documents} documents`}]}))}/>}
      {['islands','roles'].includes(view) && <AtlasSelect label="Community month" value={month} onChange={value=>{setMonth(value);setSelection(undefined);}} items={data.months.map(m=>({value:m.month,label:new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'}),badges:[{kind:'network',label:`${m.groups.filter(g=>g.identity).length} groups`}]}))}/>}
      {['rivers','units'].includes(view) && <AtlasSelect label="Disease label" searchable value={view==='rivers'?riverDisease:disease} onChange={value=>{(view==='rivers'?setRiverDisease:setDisease)(value);setSelection(undefined);}} items={[...(view==='rivers'?[{value:'-1',label:'All disease labels'}]:[]),...data.labels.map((d,i)=>({value:String(i),label:d.name}))]}/>}
      {view==='neighbours' && <AtlasSelect label="Reference report" searchable value={documentId} onChange={value=>{setDocumentId(value);setSelection(undefined);}} items={documentItems}/>}
      {view==='affinities' && <AtlasSelect label="Compared source" searchable value={affinitySource} onChange={value=>{setAffinitySource(value);setSelection(undefined);}} items={data.sources.map((s,i)=>({value:String(i),label:s.name}))}/>}
    </div>
      <nav className={styles.navigator} aria-label={`Evidence landscape view ${current+1} of ${views.length}`}>
        <button className={styles.step} aria-label="Previous landscape view" disabled={current===0} onClick={()=>changeView(views[current-1].id)}><ArrowLeft size={15}/></button>
        <button className={styles.step} aria-label="Next landscape view" disabled={current===views.length-1} onClick={()=>changeView(views[current+1].id)}><ArrowRight size={15}/></button>
      </nav>
    </header>
    <div className={styles.stage} key={view}>
      {view==='bundles' && <BundleFigure {...common} bundle={bundle} onBundle={changeBundle}/>}
      {view==='islands' && <IslandFigure {...common} month={data.months[monthIndex]}/>}
      {view==='sources' && <SourceFigure {...common} source={Number(source)} onSource={id=>setSource(String(id))}/>}
      {view==='units' && <UnitFigure {...common} disease={Number(disease)}/>}
      {view==='persistence' && <PersistenceFigure {...common} bundle={bundle}/>}
      {view==='rivers' && <RiverFigure {...common} disease={Number(riverDisease)}/>}
      {view==='nulls' && <NullFigure {...common}/>}
      {view==='neighbours' && <ReportNeighbourFigure key={documentId} {...common} document={Number(documentId)} onClear={()=>setSelection(undefined)}/>}
      {view==='affinities' && <SourceAffinityFigure key={affinitySource} {...common} source={Number(affinitySource)}/>}
      {view==='roles' && <ThemeRoleFigure key={month} {...common} month={data.months[monthIndex]}/>}
    </div>
    {inspected && <Inspector data={data} selection={inspected} onReport={onReport}/>}
  </div>;
}

function Inspector({data,selection,onReport}:{data:EvidenceLandscape;selection:LandscapeSelection;onReport:(ids:string[],expand?:boolean)=>void}) {
  const {bundle,englishTitle,atlasDocuments}=useAtlas();
  const docs=unique(selection?.documents??[]).sort((a,b)=>data.documents[b].date.localeCompare(data.documents[a].date));
  const sources=sourceSupport(data,docs);
  const documentIds = new Set(docs.map(i=>data.documents[i].id));
  const requestedRecords = selection?.records ? new Set(selection.records) : null;
  const records = bundle.records.filter(r=>documentIds.has(r.document_id) && (!requestedRecords || requestedRecords.has(r.id))).map(r=>r.id);
  return <section className={styles.inspector} aria-label="Landscape evidence inspector">
    <header><strong><BookOpen size={15} aria-hidden/>{selection.title}</strong><button onClick={()=>onReport(records,true)} disabled={!records.length}>View reports <ArrowRight size={14}/></button></header>
    <div className={styles.inspectorBody}>
      <div><dl className={styles.counts}><div><dt>Documents</dt><dd>{docs.length}</dd></div><div><dt>Sources</dt><dd>{sources.length}</dd></div></dl>
      <p className={styles.memberList}>{selection.labels.map(i=>data.labels[i].name).join(' · ')}</p>
      <div className={styles.sourceStrip}>{sources.map(s=><span key={s.source}>{data.sources[s.source].name}<b>{s.count}</b></span>)}</div>
      {selection.note && <details className={styles.disclosure}><summary>Details</summary><p>{selection.note}</p></details>}</div>
      <ol className={styles.documents}>{docs.map(i=>{const d=data.documents[i];const document=atlasDocuments.get(d.id);return <li key={d.id}><span>{formatDate(d.date)}</span><a href={d.url} target="_blank" rel="noopener noreferrer">{document?englishTitle(document):d.title}<ExternalLink size={12} aria-hidden/></a></li>;})}</ol>
    </div>
  </section>;
}

function LandscapeMethods({data}:{data:EvidenceLandscape}) {
  return <div className="atlas-literature">
    <dl className={styles.methodScope}><div><dt>Publication window</dt><dd>{formatDate(data.scope.publication_from)}–{formatDate(data.scope.publication_until)}</dd></div><div><dt>Captured through</dt><dd>{formatDate(data.scope.capture_until)}</dd></div><div><dt>Study scope</dt><dd>All {data.documents.length} documents in the study snapshot</dd></div><div><dt>Randomization</dt><dd>{data.null_model.draws} draws per model</dd></div></dl>
    <h3>Bundles and reporting units</h3><p>Bundles preserve the exact disease set assigned to a report entry. The figure includes the selected bundle and up to seven overlapping bundles. Reporting units compares pairs sharing an entry with pairs sharing a document, showing the selected label’s twenty closest neighbors by shared documents.</p>
    <h3>Sources and persistence</h3><p>Source removal counts pairs and bundles that lose all support. Persistence cells show supporting documents over all documents from each source and month; shading follows the numerator.</p>
    <h3>Groups and rivers</h3><p>Monthly groups use weighted Leiden at resolution 1. Each distinct entry label set per document contributes one unit of pair weight. Adjacent groups inherit IDs through maximum shared-label matching. Ribbons count shared labels; short ends mark labels absent from the adjacent month. Monthly totals count active labels. Unconnected labels occupy a separate lane.</p>
    <p><a href="https://doi.org/10.1038/s41598-019-41695-z" target="_blank" rel="noopener noreferrer">Traag et al., Leiden (2019)</a> · <a href="https://doi.org/10.1109/TVCG.2007.70582" target="_blank" rel="noopener noreferrer">Henry et al., NodeTrix (2007)</a> · <a href="https://doi.org/10.1371/journal.pone.0008694" target="_blank" rel="noopener noreferrer">Rosvall &amp; Bergstrom, alluvial maps (2010)</a>.</p>
    <h3>Null comparisons</h3><p>Curveball randomization preserves document label counts and label frequencies. Trades run globally or within source and month. Lines span the central 95% of draws; dots mark their means. The outlined point marks observed overlap. The twelve displayed pairs have the largest observed overlap. <a href="https://doi.org/10.1038/ncomms5114" target="_blank" rel="noopener noreferrer">Strona et al. (2014)</a>.</p>
    <h3>Report neighbours</h3><p>Each document is a binary disease-label vector weighted by log(N/df), where N is the document count and df counts documents with that label. Cosine similarity compares these vectors. The ring shows the eighteen closest positive matches; the ranked list retains every match. Other sources excludes the reference report’s publisher. Link width encodes similarity; position follows rank. <a href="https://nlp.stanford.edu/IR-book/html/htmledition/dot-products-1.html" target="_blank" rel="noopener noreferrer">Manning et al., vector-space similarity (2008)</a>.</p>
    <h3>Source affinities</h3><p>Each document distributes one unit across its disease labels. These contributions are summed by source and multiplied by the same inverse document frequencies. Chords show cosine similarity between source profiles. A source pair opens documents containing their shared labels. These are adaptations of shared-feature projections used in science mapping. <a href="https://www.vosviewer.com/download/f-23t2.pdf" target="_blank" rel="noopener noreferrer">VOSviewer manual</a>.</p>
    <h3>Theme roles</h3><p>The monthly Leiden groups share the partition used by Matrix islands and Community rivers. Edge weights use association strength, 2m·wᵢⱼ/(sᵢsⱼ), with node strengths s and total edge weight m. External connectivity is ten times the sum of edges leaving a group; internal cohesion is one hundred times the sum of internal edges divided by its label count. Each undirected edge is counted once. Bubble area follows supporting documents. Axes use log(1+x); dashed lines mark group medians. Unconnected labels are counted above the plot. <a href="https://repub.eur.nl/pub/14528" target="_blank" rel="noopener noreferrer">Van Eck &amp; Waltman (2009)</a> · <a href="https://www.bibliometrix.org/documents/bibliometrix_Report.html" target="_blank" rel="noopener noreferrer">Bibliometrix thematic mapping</a>.</p>
  </div>;
}
