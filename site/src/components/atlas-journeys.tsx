"use client";
import { useRef, type ReactNode } from 'react';
import { GitBranch, Globe2 } from 'lucide-react';
import type { AtlasSelectedChain } from '@/lib/atlas-contract';
import { AtlasChains } from './atlas-chains';
import { AtlasSelect } from './atlas-select';
import { useAtlasContentMotion } from './use-atlas-content-motion';
import styles from './atlas-analysis.module.css';

export type JourneyView = 'sequences' | 'spatial';

export function AtlasJourneys({ view, onView, chains, onReport, spatial, spatialTools, spatialCount }: {
  view: JourneyView; onView: (view: JourneyView) => void; chains: AtlasSelectedChain[]; onReport: (ids: string[]) => void;
  spatial: ReactNode; spatialTools: ReactNode; spatialCount: number;
}) {
  const content = useRef<HTMLDivElement>(null);
  useAtlasContentMotion(content, view);
  const views = [
    { value: 'sequences', label: 'Event sequences', shortLabel: 'Sequences', icon: GitBranch, count: chains.length, unit: 'sequences' },
    { value: 'spatial', label: 'Spatial links', shortLabel: 'Links', icon: Globe2, count: spatialCount, unit: 'links' },
  ];
  const current = views.find(item => item.value === view)!;
  const Icon = current.icon;
  const selector = <div className="atlas-oh-view-select"><AtlasSelect label="Journey view" value={view} onChange={value => onView(value as JourneyView)} summaryLabel={<span className="atlas-oh-mode-label"><Icon size={14} aria-hidden/><span>{current.shortLabel}</span></span>} items={views.map(item => ({ value: item.value, label: item.label, badges: [{ kind: 'count', label: `${item.count} ${item.unit} available` }] }))}/></div>;
  return view === 'sequences' ? <div className="atlas-geographic-journeys"><AtlasChains chains={chains} onReport={onReport} viewSelector={selector}/></div> : <section className={`atlas-analysis atlas-analysis-connections atlas-spatial-links ${styles.analysis}`} data-view="spatial" aria-label="Journeys">
      <header className={`${styles.analysisHeader} atlas-entry-tools atlas-panel-tools`}>{selector}{spatialTools}</header>
      <div ref={content} className={styles.analysisContent}>{spatial}</div>
    </section>;
}
