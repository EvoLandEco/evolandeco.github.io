"use client";
import { ObservationRow } from "./atlas-metrics";
import { SourceQuotation } from "./atlas-source-text";
import { useAtlas, useAtlasPanelState } from "./atlas-context";

import { useRef, useState } from "react";
import { revealAtlasEntries } from "@/lib/atlas-detail-scroll";
import { Activity, ArrowRight, CalendarDays, CircleHelp, ExternalLink, FileText, Network, ShieldCheck, Search, ChevronRight } from "lucide-react";
import type { IntelligenceExperiment, IntelligenceSeries, IntelligenceForecast, IntelligenceBacktest } from "@/lib/atlas-intelligence";
import { formatDate, linkLabels, type AtlasLink } from "@/lib/atlas";
import styles from "./atlas-analysis.module.css";
import { AtlasScope } from "./atlas-scope";
import { AtlasSelect } from "./atlas-select";
import { useElementSize } from "./use-element-size";

type DataProps = { data: IntelligenceExperiment };
const number = (value: number | null, maximumFractionDigits = 2) => value === null ? "Not defined" : value.toLocaleString("en-GB", { maximumFractionDigits });
const date = (value: string) => formatDate(value);
const methodLabel = (data: IntelligenceExperiment, id: string) => data.methods.find(method => method.id === id)?.label ?? id;
function SourceLinks({ data, ids }: DataProps & { ids: string[] }) {
  const { englishTitle } = useAtlas();
  return <ul className={styles.sources}>{data.sources.filter(source => ids.includes(source.id)).map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer"><FileText size={14} aria-hidden /><span>{englishTitle(source)}</span><ExternalLink size={12} aria-hidden /></a><small>Published {date(source.publication)} · Captured {date(source.capture)}</small></li>)}</ul>;
}
function Method({ data, id }: DataProps & { id: string }) {
  const method = data.methods.find(item => item.id === id);
  return method && <details className={styles.disclosure}><summary><CircleHelp size={14} aria-hidden />{method.label}</summary><p>{method.description}</p>{method.url && <a href={method.url} target="_blank" rel="noreferrer">Method reference <ExternalLink size={12} aria-hidden /></a>}</details>;
}

export function Monitoring({ data, kind, seriesId, links, onKind, onSeries, onReport, onLink }: DataProps & { kind: string; seriesId: string; links: AtlasLink[]; onKind: (kind: string) => void; onSeries: (id: string) => void; onReport: (ids: string[], expand?: boolean) => void; onLink: (id: string) => void }) {
  const [id, setId] = useAtlasPanelState("analysis.signal", "");
  const [query, setQuery] = useAtlasPanelState("analysis.query", "");
  const signals = data.monitoring.filter(signal => kind === "all" || signal.kind === kind).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const matching = signals.filter(signal => signal.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selected = matching.find(signal => signal.id === id) ?? matching[0];
  const select = (signal: IntelligenceExperiment["monitoring"][number]) => {
    setId(signal.id);
    if (signal.series_id) onSeries(signal.series_id);
    setQuery("");
    onKind(signal.kind);
  };
  if (kind === "count_exceedance") return <CountChecks key={seriesId} data={data} seriesId={seriesId} onReport={onReport} />;
  if (kind === "all") {
    const counts = data.monitoring.filter(signal => signal.kind === "count_exceedance").length;
    const connections = data.monitoring.filter(signal => signal.kind === "network_first_appearance").length;
    return <section className={styles.signalOverview} aria-label="Signal overview">
      <div className={styles.signalSummary}>
        <button className={styles.signalSummaryItem} onClick={() => onKind("count_exceedance")}><Activity size={18} aria-hidden /><span><strong>{counts}</strong><b>Count exceedances</b><small>{data.forecast_series.length} monitored series · View count checks</small></span><ChevronRight size={16} aria-hidden /></button>
        <button className={styles.signalSummaryItem} onClick={() => onKind("network_first_appearance")}><Network size={18} aria-hidden /><span><strong>{connections}</strong><b>First country connections</b><small>Browse archive connections</small></span><ChevronRight size={16} aria-hidden /></button>
      </div>
      {!counts && <p className={styles.note}>No count exceedances in this selection.</p>}
      <header className={styles.signalListHeading}><h3>Recent signals</h3><span>Latest {Math.min(6, signals.length)}</span></header>
      <div className={styles.signalList} aria-label="Recent signals">{signals.slice(0, 6).map(signal => <button className={styles.signalItem} key={signal.id} onClick={() => select(signal)}>{signal.kind === "count_exceedance" ? <Activity size={16} aria-hidden /> : <Network size={16} aria-hidden />}<span><strong>{signal.label}</strong><small>{signal.kind === "count_exceedance" ? "Count exceedance" : "Country connection"} · {date(signal.date)}</small></span><ChevronRight size={14} aria-hidden /></button>)}</div>
      {!signals.length && <p className={styles.notice}>No signals in this selection.</p>}
    </section>;
  }
  const relationships = selected ? links.filter(link => selected.relationship_ids.includes(link.id)) : [];
  return <div className={`${styles.split} ${styles.signalWorkspace}`}>
    <section className={styles.signalBrowser} aria-label="Country connections">
      <label className={styles.signalSearch}><Search size={15} aria-hidden /><span className="sr-only">Search country connections</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search connections…" /></label>
      <div className={styles.signalListHeading}><h3>First recorded</h3><span aria-live="polite">{matching.length}{query ? ` / ${signals.length}` : ""}</span></div>
      <div className={styles.signalList} aria-label="Monitoring signals">{matching.map(signal => <button className={styles.signalItem} type="button" key={signal.id} aria-pressed={selected?.id === signal.id} onClick={() => setId(signal.id)}><Network size={16} aria-hidden /><span><strong>{signal.label}</strong><small>{date(signal.date)} · {signal.source_ids.length} {signal.source_ids.length === 1 ? "source" : "sources"}</small></span><ChevronRight size={14} aria-hidden /></button>)}</div>
      {!matching.length && <p className={styles.note}>No matching connections.</p>}
    </section>
    {selected && <section className={`${styles.detail} ${styles.signalDetail}`} aria-label="Signal evidence" key={selected.id}>
      <div className={styles.signalDetailMeta}><span><CalendarDays size={14} aria-hidden />First recorded {date(selected.date)}</span><span><FileText size={14} aria-hidden />{selected.source_ids.length} {selected.source_ids.length === 1 ? "source" : "sources"}</span></div>
      <h3>{selected.label}</h3>
      <div className={styles.signalRelationships}>{relationships.map(link => <div key={link.id}><span className={styles.badge}>{linkLabels[link.type]}</span><h4>{link.label}</h4><p>{link.basis}</p><button onClick={() => onLink(link.id)} aria-label={`View geographic link: ${link.label}`}>Geographic link<ArrowRight size={14} aria-hidden /></button></div>)}</div>
      <div className={styles.actions}><button onClick={() => onReport(selected.record_ids, true)}><FileText size={14} aria-hidden />View reports<ArrowRight size={14} aria-hidden /></button></div>
      <h4><FileText size={14} aria-hidden />Source evidence</h4><SourceLinks data={data} ids={selected.source_ids} />
    </section>}
  </div>;
}

function CountChecks({ data, seriesId, onReport }: DataProps & { seriesId: string; onReport: (ids: string[], expand?: boolean) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const active = hovered ?? focused;
  const entries = useRef<HTMLDivElement>(null);
  const series = data.forecast_series.find(item => item.id === seriesId) ?? data.forecast_series[0];
  if (!series) return <p className={styles.notice}>No study series match the reporting selection.</p>;
  function highlight(id: string | null, fromFigure = false) {
    if (hovered === id) return;
    setHovered(id);
    if (id && fromFigure) revealAtlasEntries(entries.current, [id], entries.current?.querySelector("thead")?.getBoundingClientRect().height ?? 0);
  }
  function focus(id: string | null) {
    setFocused(id);
    highlight(null);
    if (id) revealAtlasEntries(entries.current, [id], entries.current?.querySelector("thead")?.getBoundingClientRect().height ?? 0);
  }
  return <>
    <CountChart series={series} active={active} onHighlight={id => highlight(id, true)} onFocus={focus} onReport={id => onReport([id], true)} />
    <div ref={entries} className={`${styles.table} ${styles.checkTable}`} tabIndex={0}><table><caption className="sr-only">Count checks</caption><thead><tr><th scope="col">Period</th><th scope="col">Observed</th><th scope="col">Expected</th><th scope="col">Threshold</th><th scope="col">Result</th><th scope="col">Evidence</th></tr></thead><tbody>{series.monitoring_checks.map(check => <tr key={check.measure_id} data-entry-id={check.measure_id} data-selected={active === check.measure_id} onPointerMove={() => highlight(check.measure_id)} onPointerLeave={() => highlight(null)} onFocus={() => focus(check.measure_id)} onBlur={() => setFocused(null)}><th scope="row"><button className={styles.checkReport} aria-label={`View report for ${date(check.date)}`} onClick={() => onReport([check.record_id], true)}>{date(check.date)}<ArrowRight size={12} aria-hidden /></button><small>Origin {date(check.origin)}</small></th><td>{number(check.observed)}</td><td>{number(check.expected)}</td><td>{number(check.threshold)}</td><td>{check.above_threshold ? "Above threshold" : "Not exceeded"}</td><td><SourceLinks data={data} ids={[check.source_id]} /></td></tr>)}</tbody></table></div>
  </>;
}

export function RiskProfiles({ data, initialRecord, onReport, onOneHealth, healthRecords }: DataProps & { initialRecord?: string; onReport: (ids: string[], expand?: boolean) => void; onOneHealth: (id: string) => void; healthRecords: Set<string> }) {
  const [id, setId] = useAtlasPanelState("reports.risk", data.risk_profiles.find(profile => profile.record_id === initialRecord)?.id ?? data.risk_profiles[0]?.id ?? "");
  const profile = data.risk_profiles.find(item => item.id === id) ?? data.risk_profiles[0];
  if (!profile) return <p className={styles.notice}>No risk evidence profiles in this experiment.</p>;
  function evidence(ids: string[]) {
    return <details className={styles.disclosure}><summary><FileText size={14} aria-hidden />Supporting evidence · {ids.length}</summary>{profile!.evidence.filter(item => ids.includes(item.assertion_id)).map(item => <div key={item.assertion_id}><p>{item.text}</p>{item.quotes.map(quote => <div key={quote.id}><SourceQuotation quote={quote.quote} evidenceId={quote.id} />{quote.page !== null && <cite>Page {quote.page}</cite>}</div>)}</div>)}</details>;
  }
  return <>
    <div className={styles.profileSelector}><span>Evidence profile</span><AtlasSelect label="Evidence profile" searchable value={profile.id} onChange={setId} items={data.risk_profiles.map(item => ({ value: item.id, label: item.label }))} /></div>
    <div className={styles.profileHeading}><h3>{profile.label}</h3><span><ShieldCheck size={14} aria-hidden />{profile.authority}</span></div>
    <p className={styles.note}><CalendarDays size={13} aria-hidden />Assessment {profile.assessment_date ? date(profile.assessment_date) : "date unknown"} · Published {date(profile.publication)}</p>
    <div className={styles.assessments}>{profile.assessments.map((assessment, index) => <section key={index}><p className={styles.kicker}>Source-reported assessment</p><strong>{assessment.rating}</strong><p>{assessment.population}</p>{evidence(assessment.assertion_ids)}</section>)}</div>
    <div className={styles.dimensions}>{profile.dimensions.map(dimension => <section key={dimension.id}><h4>{dimension.label}</h4><p>{dimension.summary}</p>{evidence(dimension.assertion_ids)}</section>)}</div>
    <section className={styles.unknowns}><h4><CircleHelp size={15} aria-hidden />Unknowns & limits</h4><ul>{profile.unknowns.map(unknown => <li key={unknown}>{unknown}</li>)}</ul><p>Illness probability: <strong>not estimated</strong>.</p></section>
    <div className={styles.actions}><button onClick={() => onReport([profile.record_id], true)}><FileText size={14} aria-hidden />View report</button>{healthRecords.has(profile.record_id) && <button onClick={() => onOneHealth(profile.record_id)}><Network size={14} aria-hidden />One Health evidence<ArrowRight size={13} aria-hidden /></button>}</div><Method data={data} id={profile.method_id} /><SourceLinks data={data} ids={profile.source_ids} />
  </>;
}

export function Forecasts({ data, seriesId, onReport }: DataProps & { seriesId: string; onReport: (ids: string[]) => void }) {
  const series = data.forecast_series.find(item => item.id === seriesId) ?? data.forecast_series[0];
  if (!series) return <p className={styles.notice}>No study series match the reporting selection.</p>;
  return <>
    {series ? <ForecastEvaluation key={series.id} series={series} data={data} onReport={onReport} /> : <p className={styles.notice}>No eligible forecast series in this experiment.</p>}
  </>;
}

function ForecastEvaluation({ data, series, onReport }: DataProps & { series: IntelligenceSeries; onReport: (ids: string[]) => void }) {
  const { measures } = useAtlas();
  const observationEntries = useRef<HTMLDivElement>(null);
  const [hoveredObservation, setHoveredObservation] = useState<string | null>(null);
  const [focusedObservation, setFocusedObservation] = useState<string | null>(null);
  const activeObservation = hoveredObservation ?? focusedObservation;
  function highlightObservation(id: string | null, focus = false) {
    if (!focus && hoveredObservation === id) return;
    if (focus) { setFocusedObservation(id); setHoveredObservation(null); }
    else setHoveredObservation(id);
    if (id) revealAtlasEntries(observationEntries.current, [id]);
  }
  const [model, setModel] = useAtlasPanelState(`evaluation.${series.id}.model`, "ensemble_median");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [figureActive, setFigureActive] = useState(false);
  const entries = useRef<HTMLDivElement>(null);
  function chooseModel(id: string) {
    setModel(id);
    setHovered(null);
    setFocused(null);
    setFigureActive(false);
  }
  const displayedModel = hovered ?? focused ?? model;
  const activeModel = hovered ?? focused ?? (figureActive ? model : null);
  function highlightPrediction(active: boolean) {
    if (active === figureActive) return;
    setFigureActive(active);
    if (active) revealAtlasEntries(entries.current, [displayedModel], entries.current?.querySelector("thead")?.getBoundingClientRect().height ?? 0);
  }
  const [horizon, setHorizon] = useAtlasPanelState(`evaluation.${series.id}.horizon`, 1);
  const [mode, setMode] = useAtlasPanelState(`evaluation.${series.id}.mode`, "backtest");
  const [origin, setOrigin] = useAtlasPanelState(`evaluation.${series.id}.origin`, "");
  const models = [...new Set([...series.backtests, ...series.forecasts].map(item => item.model_id))].sort((a, b) => Number(b === "ensemble_median") - Number(a === "ensemble_median"));
  const candidates = (mode === "backtest" ? series.backtests : series.forecasts).filter(item => item.model_id === displayedModel && item.horizon_weeks === horizon).sort((a, b) => a.origin.localeCompare(b.origin));
  const prediction = candidates.find(item => item.origin === origin) ?? candidates.at(-1);
  const backtest = mode === "backtest" ? series.backtests.find(item => item.model_id === displayedModel && item.horizon_weeks === horizon && item.origin === prediction?.origin) : undefined;
  const plottedObservations = prediction ? series.observations.filter(item => prediction.training_measure_ids.includes(item.measure_id) || item.measure_id === backtest?.target_measure_id).sort((a, b) => a.date.localeCompare(b.date)) : [];
  return <div className={styles.evaluation}>
    <div className={`${styles.controls} ${styles.evaluationControls}`}>
      <label><span className="sr-only">Evaluation</span><select title="Evaluation" value={mode} onChange={event => { setMode(event.target.value); setOrigin(""); }}><option value="backtest">Held-out hindcast</option><option value="extrapolation">Last-origin extrapolation</option></select></label>
      <label><span className="sr-only">Model</span><select title="Model" value={model} onChange={event => chooseModel(event.target.value)}>{models.map(item => <option key={item} value={item}>{methodLabel(data, item)}</option>)}</select></label>
      <label><span className="sr-only">Horizon</span><select title="Horizon" value={horizon} onChange={event => setHorizon(Number(event.target.value))}><option value={1}>1 week</option><option value={2}>2 weeks</option></select></label>
      <label><span className="sr-only">Historical origin</span><select title="Historical origin" value={prediction?.origin ?? ""} onChange={event => setOrigin(event.target.value)}>{candidates.map(item => <option key={item.origin} value={item.origin}>{date(item.origin)}</option>)}</select></label>
    </div>
    {prediction ? <section className={styles.prediction} aria-label="Model prediction">
      <header className={styles.predictionHeading}><dl className={styles.numbers}><div><dt>Central estimate</dt><dd>{number(prediction.central)}</dd></div><div><dt>Held-out count</dt><dd data-unavailable={!backtest || undefined}>{backtest ? number(backtest.observed) : "Not evaluated"}</dd></div><div><dt>Target WIS</dt><dd data-unavailable={!backtest || undefined}>{backtest ? number(backtest.wis, 3) : "Not evaluated"}</dd></div></dl><div className={styles.predictionHelp}><AtlasScope label="Prediction details" title={series.label}>
        <div className="atlas-literature">
          <h3>Prediction context</h3>
          <dl className={styles.methodScope}><div><dt>Evaluation</dt><dd>{mode === "backtest" ? "Held-out hindcast" : "Last-origin extrapolation"}</dd></div><div><dt>Model</dt><dd>{methodLabel(data, displayedModel)}</dd></div><div><dt>Origin</dt><dd>{date(prediction.origin)}</dd></div><div><dt>Target</dt><dd>{date(prediction.target)} · {horizon} {horizon === 1 ? "week" : "weeks"}</dd></div><div><dt>Location and unit</dt><dd>{series.location} · {series.unit}</dd></div><div><dt>Available in ATLAS at origin</dt><dd>{backtest ? (backtest.available_in_atlas_at_origin ? "Yes" : "No") : "Not evaluated"}</dd></div><div><dt>Performance baseline</dt><dd>{[...new Set(series.metrics.filter(metric => metric.horizon_weeks === horizon).map(metric => methodLabel(data, metric.baseline_id)))].join(", ")}</dd></div></dl>
          <p>Retrospective evaluation uses earlier reported observations. Historical capture dates do not establish real-time availability. Last-origin extrapolations have no observed target score and are not a current outlook.</p>
          <h3>Prediction intervals and training observations</h3>
          <div className={styles.table} tabIndex={0}><table><caption>Central prediction intervals for {date(prediction.target)}</caption><thead><tr><th scope="col">Level</th><th scope="col">Lower</th><th scope="col">Upper</th></tr></thead><tbody>{prediction.intervals.map(interval => <tr key={interval.level}><th scope="row">{interval.level * 100}%</th><td>{number(interval.lower)}</td><td>{number(interval.upper)}</td></tr>)}</tbody></table></div><div className={styles.table} tabIndex={0}><table><caption>Reported observations supplied at the historical origin</caption><thead><tr><th scope="col">Period</th><th scope="col">Count</th><th scope="col">Captured</th></tr></thead><tbody>{series.observations.filter(item => prediction.training_measure_ids.includes(item.measure_id)).map(item => <tr key={item.measure_id}><th scope="row">{date(item.date)}</th><td>{number(item.value)}</td><td>{date(item.capture)}</td></tr>)}</tbody></table></div>
          <Method data={data} id={displayedModel} /><Method data={data} id="wis" />
          <h3>Sources</h3><SourceLinks data={data} ids={series.source_ids} />
        </div>
      </AtlasScope></div></header>

      <div className={styles.predictionBody}>
        <ForecastChart series={series} prediction={prediction} modelLabel={methodLabel(data, displayedModel)} active={activeModel === displayedModel} onHighlight={highlightPrediction} activeObservation={activeObservation} onObservation={highlightObservation} onReport={onReport} />
        <div ref={observationEntries} className={styles.observationDetails} role="region" aria-label="Observation details" tabIndex={0}>
          <div className="atlas-observation-values" role="group" aria-label="Values & sources">{plottedObservations.map(item => <ObservationRow key={item.measure_id} measure={measures.get(item.measure_id)!} onReport={onReport} highlighted={activeObservation === item.measure_id} onHover={setHoveredObservation} onFocus={setFocusedObservation} />)}</div>
        </div>
      </div>
    </section> : <p className={styles.notice}>No eligible origin for this model and horizon.</p>}
    <div ref={entries} className={`${styles.table} ${styles.performanceTable}`} tabIndex={0}><table><caption className="sr-only">Hindcast performance · {horizon}-week horizon</caption><thead><tr><th scope="col">Model</th><th scope="col">Targets</th><th scope="col">MAE</th><th scope="col">WIS</th><th scope="col">Relative WIS</th><th scope="col">50% coverage</th><th scope="col">80% coverage</th><th scope="col">95% coverage</th></tr></thead><tbody>{series.metrics.filter(metric => metric.horizon_weeks === horizon).map(metric => <tr key={metric.model_id} data-entry-id={metric.model_id} data-selected={metric.model_id === displayedModel} data-active={metric.model_id === activeModel} onPointerMove={() => setHovered(metric.model_id)} onPointerLeave={() => setHovered(null)} onFocus={() => { setFocused(metric.model_id); setHovered(null); }} onBlur={() => setFocused(null)}><th scope="row"><button className={styles.modelChoice} aria-pressed={metric.model_id === model} onClick={() => chooseModel(metric.model_id)}>{methodLabel(data, metric.model_id)}</button></th><td>{metric.n}</td><td>{number(metric.mae, 3)}</td><td>{number(metric.wis, 3)}</td><td>{number(metric.relative_wis, 3)}</td>{[.5, .8, .95].map(level => { const coverage = metric.coverage.find(item => item.level === level); return <td key={level}>{coverage ? `${number(coverage.value * 100)}%` : "Not reported"}</td>; })}</tr>)}</tbody></table></div>
  </div>;
}

function ForecastChart({ series, prediction, modelLabel, active, onHighlight, activeObservation, onObservation, onReport }: { series: IntelligenceSeries; prediction: IntelligenceForecast | IntelligenceBacktest; modelLabel: string; active: boolean; onHighlight: (active: boolean) => void; activeObservation: string | null; onObservation: (id: string | null, focus?: boolean) => void; onReport: (ids: string[]) => void }) {
  const { ref, size } = useElementSize<SVGSVGElement>();
  const width = size?.width ?? 700, height = size?.height ?? 280;
  const right = width - 40, bottom = height - 24;
  const history = series.observations.filter(item => prediction.training_measure_ids.includes(item.measure_id)).sort((a, b) => a.date.localeCompare(b.date));
  const actual = "observed" in prediction ? prediction.observed : null;
  const start = Date.parse(history[0]?.date ?? prediction.origin), end = Date.parse(prediction.target);
  const maximum = Math.max(1, ...history.map(item => item.value), ...prediction.intervals.map(item => item.upper), prediction.central, actual ?? 0);
  const x = (value: string) => 48 + (Date.parse(value) - start) / (end - start) * (right - 48);
  const y = (value: number) => bottom - value / maximum * (bottom - 18);
  const segments = [...new Set(history.map(item => item.segment))];
  const target = "target_measure_id" in prediction ? series.observations.find(item => item.measure_id === prediction.target_measure_id) : undefined;
  const targetStart = history.length ? (x(history.at(-1)!.date) + x(prediction.target)) / 2 : x(prediction.target) - 18;
  function observationPoint(item: IntelligenceSeries["observations"][number], index: number, heldOut = false) {
    const left = heldOut ? targetStart : index ? (x(history[index - 1].date) + x(item.date)) / 2 : 36;
    const right = heldOut ? x(item.date) + 18 : (x(item.date) + x(history[index + 1]?.date ?? prediction.target)) / 2;
    const selected = activeObservation === item.measure_id;
    return <g key={item.measure_id} className={styles.observationPoint} data-entry-id={item.measure_id} data-selected={selected} role="button" tabIndex={0} aria-label={`${date(item.date)}: ${number(item.value)}${heldOut ? ", held-out count" : ""}. View report`}
      onPointerMove={() => onObservation(item.measure_id)} onPointerLeave={() => onObservation(null)} onFocus={() => onObservation(item.measure_id, true)} onBlur={() => onObservation(null, true)} onClick={() => onReport([item.record_id])} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onReport([item.record_id]); } }}>
      <line className={styles.checkGuide} x1={x(item.date)} x2={x(item.date)} y1="14" y2={bottom} />
      <rect className={styles.observationHit} x={left} y={heldOut ? y(item.value) - 12 : 14} width={Math.max(0, right - left)} height={heldOut ? 24 : Math.max(0, bottom - 14)} rx="3" />
      {heldOut ? <path d={`M${x(item.date)} ${y(item.value) - 6}l6 6-6 6-6-6Z`} className={styles.actualPoint} /> : <circle cx={x(item.date)} cy={y(item.value)} r={selected ? 5 : 3} className={styles.historyPoint} />}
      <title>{date(item.date)}: {number(item.value)}</title>
    </g>;
  }
  return <figure className={styles.chart} data-model-active={active}>
    <svg ref={ref} className={styles.predictionSvg} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`Reported counts through ${date(prediction.origin)} and ${prediction.horizon_weeks}-week prediction for ${date(prediction.target)}. Central estimate ${number(prediction.central)}${actual === null ? ". Target not evaluated." : `; held-out count ${number(actual)}.`}`}>
      {[0, maximum / 2, maximum].map(tick => <g key={tick}><line x1="48" x2={width - 20} y1={y(tick)} y2={y(tick)} className={styles.gridLine} /><text x="40" y={y(tick) + 4} textAnchor="end">{number(tick)}</text></g>)}
      <line x1={x(prediction.origin)} x2={x(prediction.origin)} y1="14" y2={bottom} className={styles.originLine} />
      {segments.map(segment => <polyline key={segment} points={history.filter(item => item.segment === segment).map(item => `${x(item.date)},${y(item.value)}`).join(" ")} className={styles.historyLine} />)}
      {history.map((item, index) => observationPoint(item, index))}
      <g onPointerMove={() => onHighlight(true)} onPointerLeave={() => onHighlight(false)}><rect className={styles.predictionHit} x={targetStart} y="14" width={x(prediction.target) + 18 - targetStart} height={Math.max(0, bottom - 14)} rx="4" />
      {prediction.intervals.slice().sort((a, b) => b.level - a.level).map((interval, index) => <rect key={interval.level} x={x(prediction.target) - (22 - index * 6) / 2} width={22 - index * 6} y={y(interval.upper)} height={Math.max(1, y(interval.lower) - y(interval.upper))} rx="2" className={styles.interval} data-level={interval.level}><title>{interval.level * 100}% interval: {number(interval.lower)}–{number(interval.upper)}</title></rect>)}
      <circle cx={x(prediction.target)} cy={y(prediction.central)} r="5" className={styles.predictionPoint} />
      {target && observationPoint(target, history.length, true)}
      </g>
      <text x="48" y={height - 8}>{history.length ? date(history[0].date) : date(prediction.origin)}</text><text x={right} y={height - 8} textAnchor="end">{date(prediction.target)}</text>
      <text x={x(prediction.origin) - 5} y="10" textAnchor="end">Origin · {date(prediction.origin)}</text>
    </svg>
    <figcaption><span><i className={styles.historyKey} />Reported history</span><button className={styles.predictionLegend} onPointerMove={() => onHighlight(true)} onPointerLeave={() => onHighlight(false)} onFocus={() => onHighlight(true)} onBlur={() => onHighlight(false)} onClick={() => onHighlight(true)}><i className={styles.predictionKey} />{modelLabel} · 50 / 80 / 95% intervals</button>{actual !== null && <span><i className={styles.actualKey} />Held-out count</span>}</figcaption>
  </figure>;
}

function CountChart({ series, active, onHighlight, onFocus, onReport }: { series: IntelligenceSeries; active: string | null; onHighlight: (id: string | null) => void; onFocus: (id: string | null) => void; onReport: (id: string) => void }) {
  const checks = [...series.monitoring_checks].sort((a, b) => a.date.localeCompare(b.date));
  if (!checks.length) return <p className={styles.note}>No eligible checks for this series.</p>;
  const width = 640, height = 230, left = 44, right = 622, bottom = 196;
  const dates = checks.map(check => Date.parse(check.date));
  const start = Math.min(...dates), end = Math.max(...dates);
  const max = Math.max(1, ...checks.flatMap(check => [check.observed, check.expected, check.threshold]));
  const x = (date: number) => end === start ? (left + right) / 2 : left + (date - start) / (end - start) * (right - left);
  const y = (value: number) => bottom - value / max * 174;
  return <figure className={styles.chart}><svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${series.label}: observed counts, expected counts and investigation thresholds`} onPointerLeave={() => onHighlight(null)}>
    {[0, .5, 1].map(fraction => <g key={fraction}><line className={styles.gridLine} x1={left} x2={right} y1={y(max * fraction)} y2={y(max * fraction)} /><text x={left - 8} y={y(max * fraction) + 3} textAnchor="end">{number(max * fraction, 0)}</text></g>)}
    {checks.map((check, index) => {
      const center = x(dates[index]);
      const start = index ? (x(dates[index - 1]) + center) / 2 : left - 10;
      const end = index + 1 < checks.length ? (center + x(dates[index + 1])) / 2 : right + 10;
      return <g key={check.measure_id} className={styles.checkColumn} data-entry-id={check.measure_id} data-selected={active === check.measure_id} role="button" tabIndex={0} aria-label={`${date(check.date)}: observed ${number(check.observed)}, expected ${number(check.expected)}, threshold ${number(check.threshold)}. View report`} onPointerMove={() => onHighlight(check.measure_id)} onFocus={() => onFocus(check.measure_id)} onBlur={() => onFocus(null)} onClick={() => onReport(check.record_id)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onReport(check.record_id); } }}>
        <rect className={styles.checkBand} x={start} y="16" width={end - start} height={bottom - 16} rx="3" />
        <line className={styles.checkGuide} x1={center} x2={center} y1="16" y2={bottom} />
        <line className={styles.thresholdMark} x1={center - 4} x2={center + 4} y1={y(check.threshold)} y2={y(check.threshold)} /><circle className={styles.predictionPoint} cx={center} cy={y(check.expected)} r="3" /><circle className={styles.historyPoint} cx={center} cy={y(check.observed)} r={active === check.measure_id ? 5.5 : 4} />
      </g>;
    })}
    <text x={left} y="219">{date(checks[0].date)}</text><text x={right} y="219" textAnchor="end">{date(checks.at(-1)!.date)}</text>
  </svg><figcaption><span><i className={styles.historyKey} />Observed</span><span><i className={styles.predictionKey} />Expected</span><span><i className={styles.thresholdKey} />Investigation threshold</span></figcaption></figure>;
}
