"use client";
import { memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { AtlasScope } from "./atlas-scope";
import { ChartNoAxesCombined, Database, Radar, BookOpen, CircleHelp, Activity, ListChecks } from "lucide-react";
import type { AtlasExperiment, IntelligenceExperiment, IntelligenceSeries } from "@/lib/atlas-intelligence";
import type { AtlasRecord, AtlasLink } from "@/lib/atlas";
import { formatDate } from "@/lib/atlas";
import { useAtlas, useAtlasPanelState } from "./atlas-context";
import { Monitoring, Forecasts, RiskProfiles } from "./atlas-analysis-results";
import styles from "./atlas-analysis.module.css";

type Props = { experiment: AtlasExperiment; rows: AtlasRecord[]; onReport: (ids: string[], expand?: boolean) => void };

export const AtlasAnalysis = memo(function AtlasAnalysis({ experiment, rows, links, seriesId, onSeries, onReport, onLink, footerTarget }: Props & { footerTarget: HTMLElement | null; links: AtlasLink[]; seriesId: string; onSeries: (id: string) => void; onLink: (id: string) => void }) {
  const [view, setView] = useAtlasPanelState("analysis.view", "signals");
  const [kind, setKind] = useAtlasPanelState("analysis.kind", "count_exceedance");
  const data = useMemo(() => {
    if (!experiment.data) return;
    const ids = new Set(rows.map(row => row.id)), linkIds = new Set(links.map(link => link.id));
    return { ...experiment.data,
      monitoring: experiment.data.monitoring.filter(signal => signal.record_ids.some(id => ids.has(id)) && (signal.kind !== "network_first_appearance" || signal.relationship_ids.every(id => linkIds.has(id)))),
      forecast_series: experiment.data.forecast_series.filter(series => series.observations.some(item => ids.has(item.record_id))),
    };
  }, [experiment.data, rows, links]);
  const currentSeries = data?.forecast_series.find(series => series.id === seriesId) ?? data?.forecast_series[0];
  return <section className={styles.analysis} aria-label="Experimental analysis">
    {footerTarget && createPortal(<div className="atlas-view-about"><AtlasScope buttonLabel="About Analysis" label="Methods & references" title="Analysis"><AnalysisMethods data={experiment.data} series={currentSeries} digest={experiment.digest} /></AtlasScope></div>, footerTarget)}
    <h2 className="sr-only">Analysis</h2><header className={`${styles.analysisHeader} atlas-panel-tools`} data-series={view === "evaluation" || kind === "count_exceedance"} data-view={view}>
      <div className={styles.tabs} role="group" aria-label="Analysis views">
        <button aria-label="Signals" title="Signals" aria-pressed={view === "signals"} onClick={() => setView("signals")}><Radar size={16} aria-hidden /><span>Signals</span></button>
        <button aria-label="Model evaluation" title="Model evaluation" aria-pressed={view === "evaluation"} onClick={() => setView("evaluation")}><ChartNoAxesCombined size={16} aria-hidden /><span>Model evaluation</span></button>
      </div>
      {view === "signals" && <label className={styles.toolbarSelect}><span className="sr-only">Signal type</span><select title="Signal type" value={kind} onChange={event => setKind(event.target.value)}><option value="all">All signals</option><option value="count_exceedance">Count checks</option><option value="network_first_appearance">First country connections</option></select></label>}
      {(view === "evaluation" || kind === "count_exceedance") && <label className={styles.toolbarSelect}><span className="sr-only">Monitored series</span><select title={currentSeries?.label ?? "Monitored series"} disabled={!currentSeries} value={currentSeries?.id ?? ""} onChange={event => onSeries(event.target.value)}>{data?.forecast_series.map(series => <option key={series.id} value={series.id}>{series.label}</option>)}</select></label>}
    </header>
    {!data ? <p className={styles.notice} role={experiment.error ? "alert" : "status"}>{experiment.error ?? "No validated analysis is loaded for this dataset."}</p> : <>
      {view === "signals" ? <Monitoring kind={kind} data={data} seriesId={seriesId} links={links} onKind={setKind} onSeries={onSeries} onReport={onReport} onLink={onLink} /> : <Forecasts data={data} seriesId={seriesId} />}
    </>}
  </section>;
});

function AnalysisMethods({ data, series, digest }: { data?: IntelligenceExperiment; series?: IntelligenceSeries; digest?: string }) {
  return <div className="atlas-literature">
    <p>Analysis displays calculations exported by ATLAS. The study compares models using earlier observations to predict later reported counts. Historical capture dates remain visible because this retrospective evaluation does not measure performance with data available in real time.</p>
    {data && <>
      <h3><Database size={16} aria-hidden />Study scope</h3>
      <dl className={styles.methodScope}><div><dt>Publication window</dt><dd>{formatDate(data.scope.publication_from)}–{formatDate(data.scope.publication_until)}</dd></div><div><dt>Captured through</dt><dd>{formatDate(data.scope.capture_until)}</dd></div><div><dt>Archive</dt><dd>{data.scope.documents} documents · {data.scope.records} report entries</dd></div><div><dt>Selected series</dt><dd>{series?.label ?? "No eligible series in this selection"}</dd></div></dl>
    </>}
    <h3><Activity size={16} aria-hidden />Count models</h3>
    <p><strong>Persistence random walk.</strong> The baseline uses preceding weekly changes and their negatives, drawing on the empirical baseline in <a href="https://doi.org/10.1016/j.ijforecast.2022.06.005" target="_blank" rel="noopener noreferrer">Ray et al. (2023, §2.4)</a>. ATLAS propagates discrete count probabilities, setting negative counts to zero at each step; it does not reproduce every quantile convention in that study.</p>
    <p><strong>Recent-change random walk.</strong> This variant uses the last eight changes with their signs retained and sets negative counts to zero at each step. Comparing baseline specifications is motivated by <a href="https://doi.org/10.64898/2026.03.18.26348748" target="_blank" rel="noopener noreferrer">Suez &amp; Fox (2026, preprint)</a>. The eight-change window is an ATLAS study choice, not a validated optimum from that paper.</p>
    <p><strong>Gamma–Poisson local level.</strong> ATLAS assumes a constant weekly rate over the last four observations with a Jeffreys prior. The Gamma posterior gives a negative binomial prediction for one future week, using the conjugate calculation described in the <a href="https://mc-stan.org/docs/stan-users-guide/posterior-prediction.html" target="_blank" rel="noopener noreferrer">Stan User’s Guide</a>. The window and prior are study choices. Each horizon predicts a single week, not a cumulative total.</p>
    <h3><ChartNoAxesCombined size={16} aria-hidden />Combined prediction</h3>
    <p><strong>Median ensemble.</strong> The default combines the persistence random walk, recent-change random walk and Gamma–Poisson local level with equal weight. At each origin and horizon, ATLAS takes the median of the three predictions at each quantile: the central estimate and each bound of the 50%, 80% and 95% intervals. This follows the quantile ensemble formulation in <a href="https://doi.org/10.1016/j.ijforecast.2022.06.005" target="_blank" rel="noopener noreferrer">Ray et al. (2023, §2.6)</a>.</p>
    <p>All three components must refer to the same training observations and target. No weights are fitted to held-out outcomes. The short series motivate this untrained combination; the cited study found that median ensembles can limit the influence of outlying forecasts when component performance varies.</p>
    <p>This is a quantile ensemble, not a fitted mixture-of-experts or an average of probability densities. The models share observations and may make similar errors. Combining them does not guarantee better accuracy or calibrated intervals. ATLAS scores the ensemble on the same held-out targets as its components, so its performance remains visible alongside theirs.</p>
    <h3><ChartNoAxesCombined size={16} aria-hidden />Model evaluation</h3>
    <p>Evaluation starts after eight consecutive eligible weekly observations and advances the origin through the series, holding out targets one and two weeks ahead. MAE measures median prediction error. The weighted interval score (WIS) follows <a href="https://doi.org/10.1371/journal.pcbi.1008618" target="_blank" rel="noopener noreferrer">Bracher et al. (2021)</a>, using the median and central 50%, 80% and 95% prediction intervals. The median absolute error has weight 0.5; each interval score has weight α/2, where α is one minus its coverage level. Their weighted sum is divided by 3.5. Lower scores are better; coverage reports the fraction of targets inside each interval.</p>
    <p>Relative WIS is the model’s mean WIS divided by the persistence baseline’s mean WIS on the same series and horizon. Values below one favour the model. With a complete matched forecast set, this equals the baseline-normalized pairwise ratio described by Ray et al. Last-origin extrapolations have no observed target score.</p>
    <h3><Radar size={16} aria-hidden />Signals and interpretation</h3>
    <p><strong>Count checks</strong> flag observations above the baseline’s one-week 95th predictive quantile. These are unadjusted prompts for investigation, with no validated false-alert rate or adjustment for repeated testing. <a href="https://stacks.cdc.gov/view/cdc/164155" target="_blank" rel="noopener noreferrer">Martin et al. (2024)</a> explain why surveillance anomalies require review of reporting and data quality. That report supports the interpretation, not this specific threshold rule.</p>
    <p><strong>First country connections</strong> identify the earliest supporting publication for a disease, country pair and relationship type within the study archive, preserving reported direction. This is an ATLAS archive query: it does not establish biological emergence, a new transmission route or a risk estimate. Pre-archive history is unknown, and several statements may describe the same episode. See the <a href="https://github.com/EvoLandEco/ATLAS/blob/main/docs/NETWORK_ANALYSIS.md" target="_blank" rel="noopener noreferrer">ATLAS network method</a> for the archive definition.</p>
    <p>Reporting filters select the displayed evidence; they do not refit models or reset archive history. These analyses do not correct for underreporting or collection bias. Count checks and evaluation retain every eligible observation in the selected study series. Source passages and capture dates remain attached to the results.</p>
    {data && <>
      <h3><CircleHelp size={16} aria-hidden />Limits and eligibility</h3>
      <ul className={styles.methodLimits}>{data.limitations.map(item => <li key={item}>{item}</li>)}</ul>
      {series && <><h4 className={styles.methodSeries}>{series.label}</h4><ul className={styles.methodLimits}>{series.limitations.map(item => <li key={item}>{item}</li>)}{series.excluded.map(item => <li key={item.measure_id}>{item.reason}<small className={styles.identifier}>{item.measure_id}</small></li>)}</ul></>}
      <details className={styles.disclosure}><summary><ListChecks size={14} aria-hidden />Series eligibility · {data.series_audit.length} reviewed</summary><ul className={styles.methodLimits}>{data.series_audit.map(item => <li key={item.series_id}><strong>{item.status}</strong> · {item.reason}<small className={styles.identifier}>{data.forecast_series.find(series => series.id === item.series_id)?.label ?? item.series_id}</small></li>)}</ul></details>
      <details className={styles.disclosure}><summary><Database size={14} aria-hidden />Export provenance</summary><dl className={styles.provenance}><dt>Experiment</dt><dd>{data.experiment_id}</dd><dt>Source export</dt><dd>{data.source_export_id}</dd><dt>Sidecar SHA-256</dt><dd>{digest}</dd></dl></details>
    </>}
    <h3><BookOpen size={16} aria-hidden />References</h3>
    <ol className="atlas-references">
      <li>Ray EL et al. (2023). <a href="https://doi.org/10.1016/j.ijforecast.2022.06.005" target="_blank" rel="noopener noreferrer">Comparing trained and untrained probabilistic ensemble forecasts of COVID-19 cases and deaths in the United States.</a> <i>International Journal of Forecasting</i> 39(3), 1366–1383. Published online in 2022.</li>
      <li>Suez E, Fox SJ (2026). <a href="https://doi.org/10.64898/2026.03.18.26348748" target="_blank" rel="noopener noreferrer">Basic Baseline model design choices can substantially influence performance in collaborative forecast hubs.</a> <i>medRxiv</i> 2026.03.18.26348748. Preprint; not peer reviewed.</li>
      <li>Stan Development Team. <a href="https://mc-stan.org/docs/stan-users-guide/posterior-prediction.html" target="_blank" rel="noopener noreferrer">Posterior predictive sampling.</a> <i>Stan User’s Guide</i>, “Analytic posterior and posterior predictive.” Accessed 30 September 2026.</li>
      <li>Bracher J, Ray EL, Gneiting T, Reich NG (2021). <a href="https://doi.org/10.1371/journal.pcbi.1008618" target="_blank" rel="noopener noreferrer">Evaluating epidemic forecasts in an interval format.</a> <i>PLOS Computational Biology</i> 17(2), e1008618.</li>
      <li>Martin E, Angles J, Pondo T, Pagaoa M, Torrone E (2024). <a href="https://stacks.cdc.gov/view/cdc/164155" target="_blank" rel="noopener noreferrer">Applying Aberration Detection Algorithms to Live Public Health Data: Lessons from National Syphilis Case Surveillance Data.</a> Report, CDC Stacks.</li>
    </ol>
  </div>;
}

export const AtlasRiskAssessments = memo(function AtlasRiskAssessments({ experiment, rows, initialRecord, onReport, onOneHealth }: Props & { initialRecord: string; onOneHealth: (id: string) => void }) {
  const { selectedOneHealth } = useAtlas();
  const { data, healthRecords } = useMemo(() => {
    const ids = new Set(rows.map(row => row.id));
    const health = selectedOneHealth(ids);
    return { data: experiment.data && { ...experiment.data, risk_profiles: experiment.data.risk_profiles.filter(profile => ids.has(profile.record_id)) }, healthRecords: new Set([...(health?.nodes ?? []), ...(health?.undated_nodes ?? [])].map(node => node.record_id)) };
  }, [experiment.data, rows, selectedOneHealth]);
  return <section className={styles.analysis} aria-label="Source risk assessments"><h2 className="sr-only">Source risk assessments</h2><p className={styles.note}>Authority assessments retain their stated population and date. ATLAS does not estimate a probability of harm.</p>{data ? <RiskProfiles key={initialRecord} data={data} initialRecord={initialRecord} onReport={onReport} onOneHealth={onOneHealth} healthRecords={healthRecords} /> : <p className={styles.notice}>{experiment.error ?? "No validated risk profiles are loaded."}</p>}</section>;
});
