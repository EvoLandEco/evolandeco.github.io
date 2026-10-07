import { memo, useMemo } from "react";
import { useAtlas } from "./atlas-context";
import { ObservationPlot } from "./atlas-metrics";
import { visibleMeasure } from "@/lib/atlas-metrics";
import type { AtlasRecord } from "@/lib/atlas";

export function useObservationSeries(rows: AtlasRecord[]) {
  const { metrics, measures, selectedResearch } = useAtlas();
  return useMemo(() => {
    const ids = new Set(rows.map(r => r.id));
    const view = selectedResearch(ids);
    const eligible = new Set(view.panels.flatMap(p => p.measure_ids));
    const reviewed = view.reviewed_series;
    const reviewedIds = new Set(reviewed.flatMap(s => s.members.map(m => m.measure_id)));
    const unreviewed = metrics.series.map(s => ({ id: s.context_id, review: undefined, items: s.measure_ids.map(id => measures.get(id)!).filter(m => !reviewedIds.has(m.measure_id) && eligible.has(m.measure_id) && visibleMeasure(m, ids) && !m.superseded && m.value !== null && m.observation_date !== null).sort((a, b) => a.observation_date!.localeCompare(b.observation_date!)) }))
      .filter(s => new Set(s.items.map(m => m.observation_date)).size > 1);
    const series = [...reviewed.map(review => ({ id: review.series_id, review, items: review.members.map(m => measures.get(m.measure_id)!) })), ...unreviewed];
    return series;
  }, [rows, metrics, measures, selectedResearch]);
}

export function observationSeriesLabel(series: ReturnType<typeof useObservationSeries>[number]) {
  const measure = series.items[0];
  return series.review?.label ?? [measure.disease.value, measure.geography.value, measure.label, measure.count_kind].filter(Boolean).join(" · ");
}

export const AtlasObservations = memo(function AtlasObservations({ selected, onReport }: { selected: ReturnType<typeof useObservationSeries>[number] | undefined; onReport: (ids: string[], expand?: boolean) => void }) {
  return <section className="atlas-trend-observations atlas-analysis-observations" aria-label="Reported observations">
    {selected ? <>
      <div className="atlas-observation-grid"><ObservationPlot seriesId={selected.id} series={selected.review} items={selected.items} onReport={onReport} /></div>
    </> : <p className="atlas-empty">No observations across multiple dates in this selection. Try a wider reporting window or another topic.</p>}
  </section>;
});
