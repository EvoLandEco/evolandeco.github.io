import { useEffect, useState } from 'react';
import { fetchNetworkAnalysis, selectNetworkReview, type NetworkAnalysis } from '@/lib/atlas-network-analysis';
import type { AtlasRelease } from '@/lib/atlas-release';

export function AtlasNetworkReview({ release, linkIds, recordIds }: { recordIds: ReadonlySet<string>; release: AtlasRelease; linkIds: string[] }) {
  const [analysis, setAnalysis] = useState<NetworkAnalysis>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!release.assets['network-transport.json']) return;
    const controller = new AbortController();
    fetchNetworkAnalysis(release, controller.signal).then(value => { if (!controller.signal.aborted) setAnalysis(value); }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [release, attempt]);
  if (!release.assets['network-transport.json']) return <p>No reviewed network analysis is attached to this dataset release.</p>;
  if (error) return <p role="alert">Network analysis could not be verified. <button onClick={() => { setError(false); setAttempt(n => n + 1); }}>Retry analysis</button></p>;
  if (!analysis) return <p role="status">Loading reviewed network evidence…</p>;
  const { units, groups, reviewed, assessed, unresolved, partialUnits } = selectNetworkReview(analysis, linkIds, recordIds);
  return <section aria-label="Network evidence review">
    <h3>Evidence review · Research preview</h3>
    <p><strong>{units.length} → {partialUnits}</strong> statement units after correcting known repeat reports in this selection. This is a partial correction, not a count of independent episodes, journeys or people.</p>
    <dl>
      <div><dt>Source assessment</dt><dd>{assessed} of {units.length} statements inspected</dd></div>
      <div><dt>Repeat-report groups</dt><dd>{groups.length} groups covering {reviewed} statements</dd></div>
      <div><dt>Unresolved identity</dt><dd>{unresolved} assessed statements</dd></div>
      <div><dt>Selection rule</dt><dd>Every group member and its supporting reports must be included.</dd></div>
    </dl>
    <details><summary>Movement subjects</summary><dl>
      {([['living_travellers', 'Living travellers'], ['product_shipments', 'Products'], ['human_remains', 'Human remains'], ['vessel_only', 'Vessel itineraries'], ['not_applicable', 'Shared events'], ['unresolved', 'Unresolved subject']] as const).map(([category, label]) => <div key={category}><dt>{label}</dt><dd>{units.filter(unit => unit.movement_category === category).length} statements</dd></div>)}
    </dl><p>Human travel includes only statements classified as living travellers. Aggregate travellers and individual journeys remain distinct counting units.</p></details>
    {groups.length > 0 && <details><summary>Reviewed repeat-report groups ({groups.length})</summary>
      {groups.map(group => {
        const unit = units.find(unit => unit.id === group.relationship_ids[0])!;
        return <details key={group.id}>
          <summary>{unit.from_country} {unit.directed ? '→' : '↔'} {unit.to_country} · {group.relationship_ids.length} statements → 1 reviewed unit</summary>
          <p>{group.basis}</p><p>{group.source_lineage}</p>
        </details>;
      })}
      <p>Source-checked research groups can still overlap with aggregate reports. Grouping does not establish independent episodes.</p>
    </details>}
    <p><strong>Adjusted rankings unavailable for the full dataset.</strong> {analysis.unavailable.complete_episode_ranking}</p>
    <p><strong>Collection coverage:</strong> {analysis.unavailable.collection_adjusted}</p>
    <p><strong>Surveillance adjustment:</strong> {analysis.unavailable.surveillance_adjusted}</p>
    <p>Units describe statements and reviewed groups, not numbers of travellers or cases. Uncertainty intervals are not estimated.</p>
  </section>;
}
