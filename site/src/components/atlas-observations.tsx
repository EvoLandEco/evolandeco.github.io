import { memo, useMemo } from "react";
import { useAtlas } from "./atlas-context";
import { ObservationPlot } from "./atlas-metrics";
import { visibleMeasure } from "@/lib/atlas-metrics";
import type { AtlasRecord } from "@/lib/atlas";
import { CalendarDays, ChartNoAxesCombined, CircleHelp, Clock3, Gauge, Layers3, ScanLine } from "lucide-react";
import { AtlasSelect } from "./atlas-select";
import styles from "./atlas-analysis.module.css";

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
  return <section className={`atlas-analysis-observations ${styles.evaluation} ${styles.reportedObservations}`} aria-label="Reported observations">
    {selected ? <>
      <div className={`${styles.controls} ${styles.evaluationControls}`}>
        {([["Evaluation", ScanLine], ["Model", Layers3], ["Horizon", Clock3], ["Historical origin", CalendarDays]] as const).map(([label, Icon]) => <div key={label}><span className={styles.controlLabel}><Icon size={12} aria-hidden />{label}</span><AtlasSelect label={label} disabled value="" onChange={() => {}} items={[{ value: "", label: "Unavailable" }]} /></div>)}
      </div>
      <ObservationPlot evidenceDialog seriesId={selected.id} series={selected.review} items={selected.items} onReport={onReport} renderLayout={({ caption, plot, details }) => <div className={styles.signalEvaluation}>
        <section className={styles.prediction} aria-label="Model prediction">
          <figure className={`${styles.chart} ${styles.observationFigure}`}>{plot}{caption}</figure>
          <div className={styles.figureSummary}><dl className={styles.numbers}>{["Central estimate", "Held-out count", "Target WIS"].map(label => <div key={label}><dt>{label}</dt><dd data-unavailable>Unavailable</dd></div>)}</dl><div className={styles.figureHelp}><button disabled className="atlas-scope-trigger" aria-label="Prediction details unavailable" title="No model evaluation is published for this series"><CircleHelp size={14} aria-hidden /></button></div></div>
        </section>
        <section className={styles.countChecks} aria-label="Count checks">
          <div className={`${styles.unavailableMessage} ${styles.unavailablePlot}`}><ChartNoAxesCombined size={24} aria-hidden /><strong>Reported observations only</strong><p>No model predictions or baseline checks are published for this series.</p></div>
          <div className={styles.figureSummary}><dl className={styles.numbers}>{["Checked", "Above threshold"].map(label => <div key={label}><dt>{label}</dt><dd data-unavailable>Unavailable</dd></div>)}</dl><div className={styles.figureHelp}><button disabled className="atlas-scope-trigger" aria-label="Count check details unavailable" title="No baseline checks are published for this series"><CircleHelp size={14} aria-hidden /></button></div></div>
        </section>
        <div className={styles.evaluationDetails}>
          <section className={`${styles.detailPanel} ${styles.reportedSources}`} aria-label="Observations and sources"><header className={styles.detailHeading}><h3><ChartNoAxesCombined size={14} aria-hidden />Observations</h3><span>{selected.items.length} source entries</span></header>{details}</section>
          <section className={styles.detailPanel} aria-label="Model performance"><header className={styles.detailHeading}><h3><Gauge size={14} aria-hidden />Performance</h3><span className={styles.unavailableBadge}>Unavailable</span></header><div className={styles.unavailableMessage}><Gauge size={24} aria-hidden /><strong>No model evaluation</strong><p>Target counts, prediction scores and interval coverage are unavailable for this series.</p></div></section>
        </div>
      </div>} />
    </> : <p className="atlas-empty">No observations across multiple dates in this selection. Try a wider reporting window or another topic.</p>}
  </section>;
});
