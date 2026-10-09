"use client";
import { cardTransitionClips, clipCardTransition } from "./atlas-card-transition";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { AtlasObservations, useObservationSeries, observationSeriesLabel } from "./atlas-observations";
import { AtlasScope } from "./atlas-scope";
import { AtlasEntryFilters } from "./atlas-entry-filters";
import { AtlasSelect, type AtlasSelectItem } from "./atlas-select";
import { ChartNoAxesCombined, Database, Radar, BookOpen, CircleHelp, Activity, ListChecks, ChartScatter, ShieldCheck, Globe2, GitBranch } from "lucide-react";
import type { AtlasExperiment, IntelligenceExperiment, IntelligenceSeries } from "@/lib/atlas-intelligence";
import type { AtlasRecord } from "@/lib/atlas";
import { formatDate } from "@/lib/atlas";
import { useAtlas, useAtlasPanelState } from "./atlas-context";
import { Forecasts, RiskProfiles } from "./atlas-analysis-results";
import styles from "./atlas-analysis.module.css";
import { useAtlasContentMotion } from "./use-atlas-content-motion";

export type AnalysisView = "signals" | "risk" | "spatial" | "relationships";

type Props = { experiment: AtlasExperiment; rows: AtlasRecord[]; onReport: (ids: string[], expand?: boolean) => void };

function revealRisk(root: HTMLElement | null, id: string, behavior: ScrollBehavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth") {
  const card = root?.querySelector<HTMLElement>(`[data-risk-id="${CSS.escape(id)}"]`);
  const tools = root?.previousElementSibling;
  if (!card || !(tools instanceof HTMLElement)) return;
  card.style.scrollMarginTop = `${parseFloat(getComputedStyle(tools).top) + tools.offsetHeight + 16}px`;
  card.scrollIntoView({ block: "start", behavior });
}

export const AtlasAnalysis = memo(function AtlasAnalysis({ experiment, rows, seriesId, onSeries, onReport, footerTarget, initialRiskRecord, onOneHealth, view, onView, spatial, relationships, connectionTools, spatialCount, relationshipCount }: Props & { view: AnalysisView; onView: (view: AnalysisView) => void; spatial: ReactNode; relationships: ReactNode; connectionTools: ReactNode; spatialCount: number; relationshipCount: number; initialRiskRecord: string; onOneHealth: (id: string) => void; footerTarget: HTMLElement | null; seriesId: string; onSeries: (id: string) => void }) {
  const [riskFilters, setRiskFilters] = useAtlasPanelState<string[]>("analysis.riskFilters", []);
  const [signalFilters, setSignalFilters] = useAtlasPanelState<string[]>("analysis.signalFilters", []);
  const [riskId, setRiskId] = useAtlasPanelState("analysis.risk", experiment.data?.risk_profiles.find(profile => profile.record_id === initialRiskRecord)?.id ?? "");
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const riskMotion = useRef<{ transition: ViewTransition; clear: () => void } | null>(null);
  useEffect(() => () => {
    const active = riskMotion.current;
    riskMotion.current = null;
    active?.transition.skipTransition(); active?.clear();
  }, []);
  const content = useRef<HTMLDivElement>(null);
  const observations = useObservationSeries(rows);
  useAtlasContentMotion(content, view);
  const data = useMemo(() => {
    if (!experiment.data) return;
    const ids = new Set(rows.map(row => row.id));
    return { ...experiment.data,
      risk_profiles: experiment.data.risk_profiles.filter(profile => ids.has(profile.record_id)),
      forecast_series: experiment.data.forecast_series.filter(series => series.observations.some(item => ids.has(item.record_id))),
    };
  }, [experiment.data, rows]);
  const observationSeries = observations.filter(item => !data?.forecast_series.some(series => series.id === item.id));
  const modelSeries = (data?.forecast_series ?? []).filter(() => !signalFilters.length || signalFilters.includes("model"));
  const reportedSeries = observationSeries.filter(() => !signalFilters.length || signalFilters.includes("observations"));
  const currentSeries = modelSeries.find(series => series.id === seriesId) ?? modelSeries[0];
  const selectedObservation = reportedSeries.find(item => `observations:${item.id}` === seriesId);
  const selectedSeriesId = selectedObservation ? seriesId : currentSeries?.id ?? (reportedSeries[0] ? `observations:${reportedSeries[0].id}` : "");
  const observation = selectedObservation ?? (!currentSeries ? reportedSeries[0] : undefined);
  const seriesItems: AtlasSelectItem[] = [
    ...modelSeries.map(series => ({ value: series.id, label: series.label, badges: [
      { kind: "kind" as const, label: "Model evaluation" }, { kind: "count" as const, label: `${series.observations.length} observations` },
    ] })),
    ...reportedSeries.map(series => ({ value: `observations:${series.id}`, label: observationSeriesLabel(series), badges: [
      { kind: "kind" as const, label: "Reported observations" }, { kind: "count" as const, label: `${series.items.length} observations` },
    ] })),
  ];
  const allProfiles = data?.risk_profiles ?? [];
  const profiles = useMemo(() => (data?.risk_profiles ?? []).filter(profile => {
    const authorities = riskFilters.filter(value => value.startsWith("authority:"));
    const features: Record<string, boolean> = {
      "feature:assessment": profile.assessments.length > 0,
      "feature:dated": !!profile.assessment_date,
      "feature:quotes": profile.evidence.some(item => item.quotes.length > 0),
    };
    return (!authorities.length || authorities.includes(`authority:${profile.authority}`)) && riskFilters.filter(value => value.startsWith("feature:")).every(value => features[value]);
  }), [data, riskFilters]);
  if (expandedRisk && !profiles.some(profile => profile.id === expandedRisk)) setExpandedRisk(null);
  function changeRiskDetail(id: string | null) {
    const target = id ?? expandedRisk;
    if (!target) return;
    const selector = `[data-risk-id="${CSS.escape(target)}"]`;
    const update = () => {
      flushSync(() => setExpandedRisk(id));
      if (id) content.current?.querySelector<HTMLElement>('[aria-label="Risk profile details"]')?.scrollTo({ top: 0, behavior: "instant" });
      revealRisk(content.current, target, "instant");
      content.current?.querySelector<HTMLButtonElement>(`${selector} [data-risk-${id ? "back" : "expand"}]`)?.focus({ preventScroll: true });
    };
    riskMotion.current?.transition.skipTransition();
    riskMotion.current?.clear();
    riskMotion.current = null;
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
    const named = new Set<HTMLElement>();
    const nameParts = () => {
      const card = content.current?.querySelector<HTMLElement>(selector);
      if (!card) return;
      card.style.viewTransitionName = "atlas-risk-card";
      named.add(card);
      card.querySelectorAll<HTMLElement>("[data-risk-part]").forEach(element => {
        element.style.viewTransitionName = `atlas-risk-${element.dataset.riskPart}`;
        named.add(element);
      });
    };
    document.documentElement.dataset.atlasRiskTransition = id ? "expand" : "collapse";
    nameParts();
    const card = content.current!.querySelector<HTMLElement>(selector)!;
    const cardClips = () => cardTransitionClips(card);
    const before = cardClips();
    let after = before;
    const transition = document.startViewTransition(() => { update(); nameParts(); after = cardClips(); });
    const clearClips = clipCardTransition(transition, before, () => after);
    const clear = () => {
      clearClips();
      named.forEach(element => element.style.removeProperty("view-transition-name"));
      delete document.documentElement.dataset.atlasRiskTransition;
    };
    riskMotion.current = { transition, clear };
    const finish = () => {
      if (riskMotion.current?.transition !== transition) return;
      clear(); riskMotion.current = null;
    };
    void transition.finished.then(finish, finish);
  }
  useLayoutEffect(() => { if (view === "risk" && riskId) revealRisk(content.current, riskId); }, [view, riskId]);
  const cardView = view === "spatial" || view === "relationships";
  const views = [
    { value: "signals", label: "Signals & forecasts", shortLabel: "Signals", icon: Radar, count: seriesItems.length, unit: "series" },
    { value: "spatial", label: "Spatial links", shortLabel: "Spatial", icon: Globe2, count: spatialCount, unit: "links" },
    { value: "relationships", label: "Report relationships", shortLabel: "Relationships", icon: GitBranch, count: relationshipCount, unit: "relationships" },
    { value: "risk", label: "Risk assessments", shortLabel: "Risks", icon: ShieldCheck, count: profiles.length, unit: "profiles" },
  ];
  const currentView = views.find(item => item.value === view)!;
  const ViewIcon = currentView.icon;
  return <section className={`atlas-analysis ${styles.analysis}${view === "signals" ? " atlas-analysis-signals" : view === "risk" && expandedRisk ? " atlas-analysis-risk-detail" : cardView ? " atlas-analysis-connections" : ""}`} data-view={view} data-expanded={view === "risk" && !!expandedRisk || undefined} aria-label="Experimental analysis" onKeyDown={event => {
    if (view === "risk" && expandedRisk && event.key === "Escape" && !event.defaultPrevented && !(event.target as HTMLElement).closest('.atlas-select[open], dialog')) { event.preventDefault(); event.stopPropagation(); changeRiskDetail(null); }
  }}>
    {footerTarget && createPortal(<div className="atlas-view-about"><AtlasScope buttonLabel="About Analysis" label="Methods & references" title="Analysis"><AnalysisMethods data={experiment.data} series={observation ? undefined : currentSeries} digest={experiment.digest} /></AtlasScope></div>, footerTarget)}
    <h2 className="sr-only">Analysis</h2><header className={`${styles.analysisHeader} atlas-entry-tools atlas-panel-tools`} data-view={view}>
      <div className="atlas-oh-view-select"><AtlasSelect label="Analysis view" summaryLabel={<span className="atlas-oh-mode-label"><ViewIcon size={14} aria-hidden /><span>{currentView.shortLabel}</span></span>} value={view} onChange={value => onView(value as AnalysisView)} items={views.map(item => ({ value: item.value, label: item.label, title: item.label, badges: [{ kind: "count", label: `${item.count} ${item.unit} available` }] }))} /></div>
      {cardView ? connectionTools : <>
      {view === "risk" ? <AtlasSelect label="Evidence profile" searchable disabled={!profiles.length} summaryLabel={<span className="atlas-select-choice"><span className="atlas-select-choice-title">{profiles.length ? "Find an evidence profile" : "No evidence profiles"}</span><small className="atlas-select-count" title={`${profiles.length} evidence profiles`}>{profiles.length}</small></span>} value={riskId} onChange={id => { flushSync(() => setExpandedRisk(null)); if (id === riskId) revealRisk(content.current, id); else setRiskId(id); }} items={profiles.map(item => ({ value: item.id, label: item.label, searchText: [item.authority, item.publication, ...item.dimensions.map(dimension => dimension.summary)].join(" "), badges: [
        { kind: "kind", label: item.authority },
        ...(item.assessment_date ? [{ kind: "period" as const, label: formatDate(item.assessment_date) }] : []),
      ] }))} /> : <AtlasSelect label="Monitored series" searchable disabled={!seriesItems.length} summaryLabel={<span className="atlas-select-choice"><span className="atlas-select-choice-title">{seriesItems.find(item => item.value === selectedSeriesId)?.label ?? "No series available"}</span><small className="atlas-select-count" title={`${seriesItems.length} monitored series`}>{seriesItems.length}</small></span>} value={selectedSeriesId} onChange={onSeries} items={seriesItems} />}
      {view === "risk" ? <AtlasEntryFilters key="risk" label="Filter risk profiles" value={riskFilters} onChange={setRiskFilters} count={profiles.length} total={allProfiles.length} groups={[
        { label: "Authority", match: "any", items: [...new Set([ ...allProfiles.map(profile => profile.authority), ...riskFilters.filter(value => value.startsWith("authority:")).map(value => value.slice(10)) ])].sort().map(authority => ({ value: `authority:${authority}`, label: authority })) },
        { label: "Features", match: "all", items: [
          { value: "feature:assessment", label: "Source risk rating" }, { value: "feature:dated", label: "Dated assessment" }, { value: "feature:quotes", label: "Quoted source evidence" },
        ] },
      ]} /> : <AtlasEntryFilters key="signals" label="Filter monitored series" value={signalFilters} onChange={setSignalFilters} count={seriesItems.length} total={(data?.forecast_series.length ?? 0) + observationSeries.length} groups={[
        { label: "Content available", match: "any", items: [{ value: "model", label: "Model evaluation" }, { value: "observations", label: "Reported observations" }] },
      ]} />}
      </>}
    </header>
    <div ref={content} className={styles.analysisContent}>
      {view === "spatial" ? spatial : view === "relationships" ? relationships : view === "risk" ? <AtlasRiskAssessments profiles={profiles} experiment={experiment} rows={rows} onReport={onReport} onOneHealth={onOneHealth} expandedId={expandedRisk} onExpand={changeRiskDetail} /> : <div className={styles.signalContent}>
        {signalFilters.length > 0 && !seriesItems.length ? <p className={styles.notice}>No entries match these filters. Clear the entry filters or choose another combination.</p> : observation || !data && !experiment.error ? <AtlasObservations selected={observation} onReport={onReport} />
          : !data ? <p className={styles.notice} role={experiment.error ? "alert" : "status"}>{experiment.error ?? "No validated analysis is loaded for this dataset."}</p>
          : <Forecasts data={data} seriesId={selectedSeriesId} onReport={onReport} />}
      </div>}
    </div>
  </section>;
});

function AnalysisMethods({ data, series, digest }: { data?: IntelligenceExperiment; series?: IntelligenceSeries; digest?: string }) {
  return <div className="atlas-literature">
    <p>Risk profiles retain each authority’s assessment, population and date. Their evidence dimensions connect to source passages, uncertainties and the published assessment method.</p>
    <p>Signals &amp; forecasts displays calculations exported by ATLAS. The study compares models using earlier observations to predict later reported counts. Historical capture dates remain visible because this retrospective evaluation does not measure performance with data available in real time.</p>
    <p>Spatial links retain source-described travel, shared events and geographic hypotheses. Report relationships show continuity, source hypotheses and later assessments with their supporting reports. Card counts describe evidence, not cases or independent events.</p>
    {data && <>
      <h3><Database size={16} aria-hidden />Study scope</h3>
      <dl className={styles.methodScope}><div><dt>Publication window</dt><dd>{formatDate(data.scope.publication_from)}–{formatDate(data.scope.publication_until)}</dd></div><div><dt>Captured through</dt><dd>{formatDate(data.scope.capture_until)}</dd></div><div><dt>Archive</dt><dd>{data.scope.documents} documents · {data.scope.records} report entries</dd></div><div><dt>Selected series</dt><dd>{series?.label ?? "No eligible series in this selection"}</dd></div></dl>
    </>}
    <h3><ChartScatter size={16} aria-hidden />Reported observations</h3>
    <p>Observation charts retain the source’s units, reporting periods and count definitions. Reviewed series follow ATLAS comparability decisions; other repeated observations remain separate contexts. The series selector includes observation contexts without eligible models. Prediction shows the reported series and model intervals. Count checks shows reported points against expected counts and investigation thresholds. Both figures share source observations, training and held-out labels, and model performance comparisons. Hover or focus connects each plotted value to its source row; selecting it opens the report.</p>
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

export const AtlasRiskAssessments = memo(function AtlasRiskAssessments({ experiment, profiles, rows, onReport, onOneHealth, expandedId, onExpand }: Props & { profiles: IntelligenceExperiment["risk_profiles"]; onOneHealth: (id: string) => void; expandedId: string | null; onExpand: (id: string | null) => void }) {
  const { selectedOneHealth } = useAtlas();
  const { data, healthRecords } = useMemo(() => {
    const ids = new Set(rows.map(row => row.id));
    const health = selectedOneHealth(ids);
    return { data: experiment.data && { ...experiment.data, risk_profiles: profiles }, healthRecords: new Set([...(health?.nodes ?? []), ...(health?.undated_nodes ?? [])].map(node => node.record_id)) };
  }, [experiment.data, profiles, rows, selectedOneHealth]);
  return <section className={styles.riskWorkspace} aria-label="Source risk assessments"><h2 className="sr-only">Source risk assessments</h2>{data && !profiles.length ? <p className={styles.notice}>No risk evidence profiles match these filters.</p> : data ? <RiskProfiles data={data} onReport={onReport} onOneHealth={onOneHealth} healthRecords={healthRecords} expandedId={expandedId} onExpand={onExpand} /> : <p className={styles.notice}>{experiment.error ?? "No validated risk profiles are loaded."}</p>}</section>;
});
