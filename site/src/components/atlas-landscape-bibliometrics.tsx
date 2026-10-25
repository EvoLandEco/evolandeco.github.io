"use client";
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ArrowUpRight, Building2, Files } from 'lucide-react';
import { formatDate } from '@/lib/atlas';
import { median, reportingProfiles, reportNeighbours, sourceAffinities, themeRoles } from '@/lib/atlas-landscape-bibliometrics';
import { unique, type EvidenceLandscape, type LandscapeSelection } from '@/lib/atlas-evidence-landscape';
import { useAtlas, useAtlasPanelState } from './atlas-context';
import { useElementSize } from './use-element-size';
import styles from './atlas-evidence-landscape.module.css';

type Common = { data: EvidenceLandscape; onInspect: (selection: LandscapeSelection) => void };
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const axisNumber = (value: number) => value.toLocaleString('en-GB', { notation: 'compact', maximumFractionDigits: 1 });
const enter = (action: () => void) => (event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); action(); } };
const truncate = (text: string, length: number) => text.length > length ? `${text.slice(0, length - 1)}…` : text;
function useTitles(data: EvidenceLandscape) {
  const { atlasDocuments, englishTitle } = useAtlas();
  return (id: number) => { const document = atlasDocuments.get(data.documents[id].id); return document ? englishTitle(document) : data.documents[id].title; };
}

export function ReportNeighbourFigure({ data, document, onInspect, onClear }: Common & { document: number; onClear: () => void }) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [scope, setScope] = useAtlasPanelState('landscape.neighbourScope', 'cross');
  const [hovered, setHovered] = useState<number>();
  const profiles = useMemo(() => reportingProfiles(data), [data]);
  const neighbours = useMemo(() => reportNeighbours(data, profiles.documents, document, scope === 'cross'), [data, profiles, document, scope]);
  const shown = neighbours.slice(0, 18), active = shown.find(n => n.document === hovered);
  const title = useTitles(data), seed = data.documents[document];
  const width = size?.width ?? 600, height = Math.min(420, width), cx = width / 2, cy = height / 2, radius = Math.min(width, height) / 2 - 38;
  const positions = shown.map((n, i) => ({ ...n, x: cx + radius * Math.cos(i / shown.length * Math.PI * 2 - Math.PI / 2), y: cy + radius * Math.sin(i / shown.length * Math.PI * 2 - Math.PI / 2) }));
  const inspect = (n: typeof neighbours[number]) => onInspect({ title: `${number(n.similarity)} similarity · ${n.labels.length} shared ${n.labels.length === 1 ? 'label' : 'labels'}`, labels: n.labels, documents: [document, n.document] });
  return <div ref={ref} className={styles.figure}>
    <div className={styles.bibliometricBar}>
      <div className={styles.measureLine}><strong>{neighbours.length}</strong><span>neighbours</span><strong>{unique(neighbours.map(n => data.documents[n.document].source)).length}</strong><span>sources</span></div>
      <div className={styles.scopeSwitch} role="group" aria-label="Neighbour sources">
        <button aria-pressed={scope === 'cross'} onClick={() => { setScope('cross'); setHovered(undefined); onClear(); }}><Building2 size={13}/>Other sources</button>
        <button aria-pressed={scope === 'all'} onClick={() => { setScope('all'); setHovered(undefined); onClear(); }}><Files size={13}/>All</button>
      </div>
    </div>
    {shown.length ? <>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Report similarity neighbourhood, ${shown.length} closest reports`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border)" strokeDasharray="2 7"/>
        <circle cx={cx} cy={cy} r={radius * .62} fill="var(--atlas-green)" fillOpacity={.025}/>
        {positions.map(n => <line key={n.document} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke={data.documents[n.document].source === seed.source ? 'var(--primary)' : 'var(--atlas-green)'} strokeWidth={.6 + n.similarity * 3.4} opacity={active ? active.document === n.document ? .8 : .08 : .18 + .24 * n.similarity}/>)}
        <circle cx={cx} cy={cy} r={width < 400 ? 44 : 55} fill="var(--background)" stroke="var(--atlas-green)" strokeOpacity={.3}/>
        <text x={cx} y={cy - 8} textAnchor="middle" className={styles.secondary}>{active ? 'Similarity' : 'Selected report'}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" className={styles.metricText}>{active ? number(active.similarity) : formatDate(seed.date)}</text>
        {positions.map((n, i) => <g key={n.document} role="button" tabIndex={0} aria-label={`Neighbour ${i + 1}: ${title(n.document)}, similarity ${number(n.similarity)}`} className={styles.svgButton} onMouseEnter={() => setHovered(n.document)} onMouseLeave={() => setHovered(undefined)} onFocus={() => setHovered(n.document)} onBlur={() => setHovered(undefined)} onClick={() => inspect(n)} onKeyDown={enter(() => inspect(n))}>
          <circle cx={n.x} cy={n.y} r={18} fill="var(--background)"/>
          <circle cx={n.x} cy={n.y} r={15} fill={data.documents[n.document].source === seed.source ? 'var(--primary)' : 'var(--atlas-green)'} fillOpacity={hovered === n.document ? .26 : .1} stroke={data.documents[n.document].source === seed.source ? 'var(--primary)' : 'var(--atlas-green)'} strokeOpacity={.45}/>
          <text x={n.x} y={n.y + 4} textAnchor="middle">{i + 1}</text>
        </g>)}
      </svg>
      <div className={styles.legend}><span><i/>Other source</span>{scope === 'all' && <span><i data-blue/>Same source</span>}<span>Link width · similarity</span><span>{shown.length} closest reports</span></div>
      <ol className={styles.neighbourList}>{neighbours.map((n, i) => <li key={n.document}><button onClick={() => inspect(n)} onMouseEnter={() => setHovered(n.document)} onMouseLeave={() => setHovered(undefined)} onFocus={() => setHovered(n.document)} onBlur={() => setHovered(undefined)}>
        <span className={styles.rank}>{i + 1}</span><span><strong>{title(n.document)}</strong><span className={styles.rowMetadata}>{data.sources[data.documents[n.document].source].name} · {formatDate(data.documents[n.document].date)}</span></span><span className={styles.similarityScore}>{number(n.similarity)}<ArrowUpRight size={13}/></span>
      </button></li>)}</ol>
    </> : <p className={styles.empty}>No reports share weighted disease labels in this selection.</p>}
  </div>;
}

export function SourceAffinityFigure({ data, source, onInspect }: Common & { source: number }) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [hovered, setHovered] = useState<number>();
  const gradient = useId();
  const profiles = useMemo(() => reportingProfiles(data), [data]);
  const affinities = useMemo(() => sourceAffinities(data, profiles.sources, source), [data, profiles, source]);
  const active = affinities.find(a => a.source === hovered) ?? affinities[0];
  const width = size?.width ?? 600, height = Math.min(430, width + 20), cx = width / 2, cy = height / 2, radius = Math.min(width, height) / 2 - 34;
  const point = (id: number) => ({ x: cx + radius * Math.cos(id / data.sources.length * Math.PI * 2 - Math.PI / 2), y: cy + radius * Math.sin(id / data.sources.length * Math.PI * 2 - Math.PI / 2) });
  const seed = point(source);
  const inspect = (a: typeof affinities[number]) => onInspect({ title: `${data.sources[source].name} × ${data.sources[a.source].name}`, labels: a.labels, documents: data.documents.flatMap((d, i) => (d.source === source || d.source === a.source) && d.labels.some(label => a.labels.includes(label)) ? [i] : []), note: `Cosine similarity ${number(a.similarity)}; ${a.labels.length} shared disease labels` });
  return <div ref={ref} className={styles.figure}>
    <div className={styles.measureLine}><strong>{affinities.filter(a => a.similarity > 0).length}</strong><span>related sources</span><strong>{data.documents.filter(d => d.source === source).length}</strong><span>selected-source documents</span></div>
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Source affinity chord network">
      <defs><linearGradient id={gradient}><stop stopColor="var(--primary)"/><stop offset="1" stopColor="var(--atlas-green)"/></linearGradient></defs>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="var(--border)"/>
      {affinities.filter(a => a.similarity > 0).map(a => { const p = point(a.source); return <path key={a.source} d={`M${seed.x},${seed.y} Q${cx},${cy} ${p.x},${p.y}`} fill="none" stroke={`url(#${gradient})`} strokeWidth={.5 + a.similarity * 8} opacity={active?.source === a.source ? .8 : .12}/>; })}
      <rect x={cx - 85} y={cy - 39} width={170} height={78} rx={20} fill="var(--background)" fillOpacity={.93}/>
      <text x={cx} y={cy - 14} textAnchor="middle" className={styles.secondary}>{active ? `Source ${source + 1} ↔ ${active.source + 1}` : 'Source affinity'}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className={styles.metricText}>{active ? number(active.similarity) : '0'}</text>
      <text x={cx} y={cy + 31} textAnchor="middle" className={styles.secondary}>{active?.labels.length ?? 0} shared labels</text>
      {data.sources.map((s, id) => { const p = point(id), affinity = affinities.find(a => a.source === id), action = () => affinity ? inspect(affinity) : onInspect({ title: s.name, labels: unique(data.documents.filter(d => d.source === id).flatMap(d => d.labels)), documents: data.documents.flatMap((d, i) => d.source === id ? [i] : []) }); return <g key={s.id} role="button" tabIndex={0} aria-label={`Source ${id + 1}: ${s.name}${affinity ? `, similarity ${number(affinity.similarity)}` : ', selected source'}`} className={styles.svgButton} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(undefined)} onFocus={() => setHovered(id)} onBlur={() => setHovered(undefined)} onClick={action} onKeyDown={enter(action)}>
        <circle cx={p.x} cy={p.y} r={17} fill="var(--background)"/>
        <circle cx={p.x} cy={p.y} r={id === source ? 17 : 14} fill={id === source ? 'var(--atlas-green)' : 'var(--primary)'} fillOpacity={id === source ? .2 : active?.source === id ? .16 : .06} stroke={id === source ? 'var(--atlas-green)' : 'var(--primary)'} strokeOpacity={id === source || active?.source === id ? .7 : .2}/>
        <text x={p.x} y={p.y + 4} textAnchor="middle">{id + 1}</text>
      </g>; })}
    </svg>
    <div className={styles.legend}><span><i/>Selected source</span><span><i data-blue/>Compared sources</span><span>Link width · similarity</span></div>
    <ol className={styles.neighbourList}>{affinities.map(a => <li key={a.source}><button onClick={() => inspect(a)} onMouseEnter={() => setHovered(a.source)} onMouseLeave={() => setHovered(undefined)} onFocus={() => setHovered(a.source)} onBlur={() => setHovered(undefined)}><span className={styles.rank}>{a.source + 1}</span><span><strong>{data.sources[a.source].name}</strong></span><span className={styles.similarityScore}>{number(a.similarity)}<ArrowUpRight size={13}/></span></button></li>)}</ol>
  </div>;
}

export function ThemeRoleFigure({ data, month, onInspect }: Common & { month: EvidenceLandscape['months'][number] }) {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [hovered, setHovered] = useState<string>();
  const themes = useMemo(() => themeRoles(data, month), [data, month]);
  const width = size?.width ?? 600, height = Math.max(330, Math.min(470, width * .8)), left = 74, right = width - 28, top = 28, bottom = height - 52;
  const xmax = Math.max(1, ...themes.map(t => t.centrality)) * 1.4, ymax = Math.max(1, ...themes.map(t => t.density)) * 1.4;
  const ymin = themes.length ? Math.min(...themes.map(t => t.density)) * .65 : 0;
  const x = (n: number) => left + (right - left) * Math.log1p(n) / Math.log1p(xmax), y = (n: number) => bottom - (bottom - top) * (Math.log1p(n) - Math.log1p(ymin)) / (Math.log1p(ymax) - Math.log1p(ymin));
  const splitX = x(median(themes.map(t => t.centrality))), splitY = y(median(themes.map(t => t.density)));
  const largest = Math.max(1, ...themes.map(t => t.documents.length));
  const inspect = (theme: typeof themes[number]) => onInspect({ title: `G${theme.identity} · ${theme.title}`, labels: theme.labels, documents: theme.documents, note: `External connectivity ${number(theme.centrality)}; internal cohesion ${number(theme.density)}` });
  return <div ref={ref} className={styles.figure}>
    <div className={styles.measureLine}><strong>{themes.length}</strong><span>communities</span><strong>{month.groups.filter(g => !g.identity).reduce((n, g) => n + g.labels.length, 0)}</strong><span>unconnected labels</span></div>
    {themes.length ? <>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Theme roles by external connectivity and internal cohesion">
        <rect x={left} y={top} width={right - left} height={bottom - top} rx={12} fill="var(--primary)" fillOpacity={.025}/>
        <rect x={splitX} y={top} width={right - splitX} height={splitY - top} fill="var(--atlas-green)" fillOpacity={.055}/>
        <line x1={splitX} x2={splitX} y1={top} y2={bottom} stroke="var(--muted-foreground)" strokeOpacity={.35} strokeDasharray="3 5"/>
        <line x1={left} x2={right} y1={splitY} y2={splitY} stroke="var(--muted-foreground)" strokeOpacity={.35} strokeDasharray="3 5"/>
        {[0, .5, 1].map(t => { const vx = Math.expm1(t * Math.log1p(xmax)), vy = Math.expm1(Math.log1p(ymin) + t * (Math.log1p(ymax) - Math.log1p(ymin))); return <g key={t}><text x={x(vx)} y={bottom + 20} textAnchor="middle" className={styles.secondary}>{axisNumber(vx)}</text><text x={left - 12} y={y(vy) + 4} textAnchor="end" className={styles.secondary}>{axisNumber(vy)}</text></g>; })}
        <text x={(left + right) / 2} y={height - 5} textAnchor="middle">External connectivity</text>
        <text transform={`translate(15 ${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle">Internal cohesion</text>
        {[...themes].sort((a, b) => b.documents.length - a.documents.length).map(theme => { const r = Math.sqrt(theme.documents.length / largest) * (width < 400 ? 20 : 28), active = hovered === theme.id; return <g key={theme.id} role="button" tabIndex={0} aria-label={`Group ${theme.identity}: ${theme.title}; connectivity ${number(theme.centrality)}, cohesion ${number(theme.density)}, ${theme.documents.length} documents`} className={styles.svgButton} onMouseEnter={() => setHovered(theme.id)} onMouseLeave={() => setHovered(undefined)} onFocus={() => setHovered(theme.id)} onBlur={() => setHovered(undefined)} onClick={() => inspect(theme)} onKeyDown={enter(() => inspect(theme))}>
          <circle cx={x(theme.centrality)} cy={y(theme.density)} r={r} fill={theme.identity % 2 ? 'var(--primary)' : 'var(--atlas-green)'} fillOpacity={active ? .45 : .2} stroke={theme.identity % 2 ? 'var(--primary)' : 'var(--atlas-green)'} strokeOpacity={hovered && !active ? .2 : .65}/>
          <text x={x(theme.centrality)} y={y(theme.density) + 4} textAnchor="middle">{theme.identity}</text>
        </g>; })}
      </svg>
      <div className={styles.legend}><span>Area · documents</span><span>Dashed lines · medians</span><span>Logarithmic axes</span></div>
      <div className={styles.themeRoster}>{themes.map(theme => <button key={theme.id} onClick={() => inspect(theme)} onMouseEnter={() => setHovered(theme.id)} onMouseLeave={() => setHovered(undefined)} onFocus={() => setHovered(theme.id)} onBlur={() => setHovered(undefined)}><span className={styles.rank}>{theme.identity}</span><span><strong>{truncate(theme.title, 90)}</strong><span className={styles.rowMetadata}>{theme.labels.length} labels · {theme.documents.length} documents</span></span><ArrowUpRight size={14}/></button>)}</div>
    </> : <p className={styles.empty}>No connected communities in this month.</p>}
  </div>;
}
