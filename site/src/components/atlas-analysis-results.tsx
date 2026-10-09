"use client";
import { AnimatePresence, motion as m, useInView } from "motion/react";
import { ObservationRow } from "./atlas-metrics";
import { SourceQuotation } from "./atlas-source-text";
import { useAtlas, useAtlasPanelState } from "./atlas-context";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { forecastSeriesIndex } from "@/lib/atlas-forecast";
import { revealAtlasEntries } from "@/lib/atlas-detail-scroll";
import { ArrowLeft, ArrowRight, CalendarDays, ChartNoAxesCombined, ChevronsDown, CircleHelp, Clock3, Expand, ExternalLink, FileText, Gauge, HeartHandshake, Layers3, ScanLine, ShieldCheck } from "lucide-react";
import type { IntelligenceExperiment, IntelligenceSeries, IntelligenceForecast, IntelligenceBacktest } from "@/lib/atlas-intelligence";
import { formatDate } from "@/lib/atlas";
import styles from "./atlas-analysis.module.css";
import { AtlasSelect } from "./atlas-select";
import { AtlasScope } from "./atlas-scope";
import { useAtlasMasonry } from "./use-atlas-masonry";
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

type RiskProps = DataProps & { onReport: (ids: string[], expand?: boolean) => void; onOneHealth: (id: string) => void; healthRecords: Set<string>; expandedId: string | null; onExpand: (id: string | null) => void };

export function RiskProfiles(props: RiskProps) {
  const list = useAtlasMasonry(!!props.expandedId, props.data.risk_profiles, 320);
  if (!props.data.risk_profiles.length) return <p className={styles.notice}>No risk evidence profiles match the reporting selection.</p>;
  return <div ref={list} className={styles.riskProfiles} data-expanded={!!props.expandedId || undefined}>{props.data.risk_profiles.map(profile => <RiskProfile key={profile.id} {...props} profile={profile} />)}</div>;
}

function RiskProfile({ data, profile, onReport, onOneHealth, healthRecords, expandedId, onExpand }: RiskProps & { profile: IntelligenceExperiment["risk_profiles"][number] }) {
  const card = useRef<HTMLElement>(null);
  const ready = useInView(card, { once: true, margin: "200px 0px" });
  const expanded = expandedId === profile.id;
  const [finding, ...dimensions] = profile.dimensions;
  function evidence(ids: string[]) {
    return <div className={styles.profileStatements}>{profile.evidence.filter(item => ids.includes(item.assertion_id)).map(item => <div key={item.assertion_id}><p>{item.text}</p>{item.quotes.length > 0 && <details className={styles.disclosure}><summary><FileText size={14} aria-hidden />Source quotations · {item.quotes.length}</summary>{item.quotes.map(quote => <div key={quote.id}><SourceQuotation quote={quote.quote} evidenceId={quote.id} />{quote.page !== null && <cite>Page {quote.page}</cite>}</div>)}</details>}</div>)}</div>;
  }
  return <article ref={card} className={`${styles.riskHero} atlas-evidence-card`} data-risk-id={profile.id} data-ready={ready} data-expanded={expanded || undefined} hidden={!!expandedId && !expanded} aria-label={profile.label}>
    {expanded && <div className={`${styles.profileBack} atlas-card-back`}><button className="atlas-watch-close" data-risk-part="control" data-risk-back onClick={() => onExpand(null)}><ArrowLeft size={15} aria-hidden />Back to risks</button><span>{profile.evidence.length} evidence statements</span></div>}
    <header className={`${styles.profileHeading} atlas-card-heading`}>
      <div data-risk-part="heading"><p className={styles.kicker}><ShieldCheck size={13} aria-hidden />{profile.authority}</p><h3>{profile.label}</h3></div>
      <div className={styles.profileDates} data-risk-part="dates"><span className="atlas-card-date"><CalendarDays size={12} aria-hidden /><span>Assessment</span>{profile.assessment_date ? <time dateTime={profile.assessment_date}>{date(profile.assessment_date)}</time> : <strong>Date unknown</strong>}</span><span className="atlas-card-date"><CalendarDays size={12} aria-hidden /><span>Published</span><time dateTime={profile.publication}>{date(profile.publication)}</time></span></div>
    </header>
    <div className={`${styles.profileBody} atlas-card-body`} data-risk-part="body" tabIndex={expanded ? 0 : undefined} role={expanded ? "region" : undefined} aria-label={expanded ? "Risk profile details" : undefined}>
    <div className="atlas-card-main">
      <div className={styles.assessments}>
        {!!profile.assessments.length && <section className={styles.sourceAssessment} role="group" aria-label="Source assessment"><p className={styles.kicker}><ShieldCheck size={13} aria-hidden />Source assessment</p>{profile.assessments.map((assessment, index) => <div key={index}><strong>{assessment.rating}</strong><p>{assessment.population}</p>{expanded && evidence(assessment.assertion_ids)}</div>)}</section>}
        {finding && <section role="group" aria-label={finding.label}><h4 className={styles.kicker}><FileText size={13} aria-hidden />{finding.label}</h4><p className={styles.findingSummary}>{finding.summary}</p>{expanded && evidence(finding.assertion_ids)}</section>}
      </div>
      <div className={styles.dimensions}>{dimensions.map(dimension => <section key={dimension.id}><h4 className={styles.kicker}><FileText size={13} aria-hidden />{dimension.label}</h4><p>{dimension.summary}</p>{expanded && evidence(dimension.assertion_ids)}</section>)}</div>
    </div>
    {expanded && <aside className="atlas-card-aside">
      <dl className="atlas-card-counts"><div><dt>Evidence</dt><dd>{profile.evidence.length}</dd></div><div><dt>Sources</dt><dd>{profile.source_ids.length}</dd></div><div><dt>Areas</dt><dd>{profile.dimensions.length}</dd></div></dl>
      <section className={styles.unknowns}><h4><CircleHelp size={14} aria-hidden />Unknowns &amp; limits</h4><ul>{profile.unknowns.map(unknown => <li key={unknown}>{unknown}</li>)}</ul></section>
      <section><h4><FileText size={14} aria-hidden />Sources &amp; method</h4><SourceLinks data={data} ids={profile.source_ids} /><Method data={data} id={profile.method_id} /></section>
    </aside>}
    </div>
    <footer className="atlas-card-footer">
      {!expanded && <button className={styles.profileExpand} data-risk-part="control" data-risk-expand onClick={() => onExpand(profile.id)}><Expand size={14} aria-hidden />View details<span>{profile.dimensions.length} evidence areas</span><ArrowRight size={14} aria-hidden /></button>}
      <button aria-label="View report" title="View report" onClick={() => onReport([profile.record_id], true)}><FileText size={14} aria-hidden />{expanded && "View report"}</button>
      {healthRecords.has(profile.record_id) && <button aria-label="One Health" title="One Health" onClick={() => onOneHealth(profile.record_id)}><HeartHandshake size={14} aria-hidden />{expanded && "One Health"}</button>}
    </footer>
  </article>;
}

export function Forecasts({ data, seriesId, onReport }: DataProps & { seriesId: string; onReport: (ids: string[]) => void }) {
  const series = data.forecast_series.find(item => item.id === seriesId) ?? data.forecast_series[0];
  if (!series) return <p className={styles.notice}>No study series match the reporting selection.</p>;
  return <ForecastEvaluation key={series.id} series={series} data={data} onReport={onReport} />;
}

function ForecastEvaluation({ data, series, onReport }: DataProps & { series: IntelligenceSeries; onReport: (ids: string[]) => void }) {
  const { measures } = useAtlas();
  const index = useMemo(() => forecastSeriesIndex(series), [series]);
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
  const [model, setModel] = useAtlasPanelState<string>(`evaluation.${series.id}.model`, index.models[0] ?? "");
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const [figureActive, setFigureActive] = useState(false);
  const entries = useRef<HTMLDivElement>(null);
  const performanceId = useId();
  const [moreModels, setMoreModels] = useState(false);
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
    if (active) revealAtlasEntries(entries.current, [displayedModel]);
  }
  const [horizon, setHorizon] = useAtlasPanelState(`evaluation.${series.id}.horizon`, 1);
  const [mode, setMode] = useAtlasPanelState(`evaluation.${series.id}.mode`, "backtest");
  const [origin, setOrigin] = useAtlasPanelState(`evaluation.${series.id}.origin`, "");
  const candidates = useMemo<(IntelligenceForecast | IntelligenceBacktest)[]>(() => (mode === "backtest" ? series.backtests : series.forecasts).filter(item => item.model_id === displayedModel && item.horizon_weeks === horizon).sort((a, b) => a.origin.localeCompare(b.origin)), [series, mode, displayedModel, horizon]);
  const prediction = candidates.find(item => item.origin === origin) ?? candidates.at(-1);
  const backtest = useMemo(() => mode === "backtest" ? series.backtests.find(item => item.model_id === displayedModel && item.horizon_weeks === horizon && item.origin === prediction?.origin) : undefined, [series, mode, displayedModel, horizon, prediction?.origin]);
  const trainingIds = useMemo(() => new Set(prediction?.training_measure_ids), [prediction]);
  useEffect(() => {
    const element = entries.current;
    if (!element) return;
    const update = () => setMoreModels(Math.ceil(element.scrollTop) < element.scrollHeight - element.clientHeight);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    [...element.children].forEach(card => observer.observe(card));
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [series, horizon]);
  return <div className={styles.evaluation}>
    <div className={`${styles.controls} ${styles.evaluationControls}`}>
      <div><span className={styles.controlLabel}><ScanLine size={12} aria-hidden />Evaluation</span><AtlasSelect label="Evaluation" value={mode} onChange={value => { setMode(value); setOrigin(""); }} items={[{ value: "backtest", label: "Held-out hindcast" }, { value: "extrapolation", label: "Last-origin extrapolation" }]} /></div>
      <div><span className={styles.controlLabel}><Layers3 size={12} aria-hidden />Model</span><AtlasSelect label="Model" value={model} onChange={chooseModel} disabled={!index.models.length} items={index.models.map(item => ({ value: item, label: methodLabel(data, item) }))} /></div>
      <div><span className={styles.controlLabel}><Clock3 size={12} aria-hidden />Horizon</span><AtlasSelect label="Horizon" value={String(horizon)} onChange={value => setHorizon(Number(value))} items={[{ value: "1", label: "1 week" }, { value: "2", label: "2 weeks" }]} /></div>
      <div><span className={styles.controlLabel}><CalendarDays size={12} aria-hidden />Historical origin</span><AtlasSelect label="Historical origin" value={prediction?.origin ?? ""} onChange={setOrigin} disabled={!candidates.length} items={candidates.map(item => ({ value: item.origin, label: date(item.origin) }))} /></div>
    </div>
    <div className={styles.signalEvaluation}>
      <section className={styles.prediction} aria-label="Model prediction">
        <ForecastChart series={series} index={index} prediction={prediction} modelLabel={methodLabel(data, displayedModel)} active={activeModel === displayedModel} onHighlight={highlightPrediction} activeObservation={activeObservation} onObservation={highlightObservation} onReport={onReport} />
        {prediction ? <div className={styles.figureSummary}><dl className={styles.numbers}><div><dt>Central estimate</dt><dd>{number(prediction.central)}</dd></div><div><dt>Held-out count</dt><dd data-unavailable={!backtest || undefined}>{backtest ? number(backtest.observed) : "Not evaluated"}</dd></div><div><dt>Target WIS</dt><dd data-unavailable={!backtest || undefined}>{backtest ? number(backtest.wis, 3) : "Not evaluated"}</dd></div></dl><div className={styles.figureHelp}><AtlasScope label="Prediction details" title={series.label}>
          <div className="atlas-literature">
            <h3>Prediction context</h3>
            <dl className={styles.methodScope}><div><dt>Evaluation</dt><dd>{mode === "backtest" ? "Held-out hindcast" : "Last-origin extrapolation"}</dd></div><div><dt>Model</dt><dd>{methodLabel(data, displayedModel)}</dd></div><div><dt>Origin</dt><dd>{date(prediction.origin)}</dd></div><div><dt>Target</dt><dd>{date(prediction.target)} · {horizon} {horizon === 1 ? "week" : "weeks"}</dd></div><div><dt>Location and unit</dt><dd>{series.location} · {series.unit}</dd></div><div><dt>Available in ATLAS at origin</dt><dd>{backtest ? (backtest.available_in_atlas_at_origin ? "Yes" : "No") : "Not evaluated"}</dd></div><div><dt>Performance baseline</dt><dd>{[...new Set(series.metrics.filter(metric => metric.horizon_weeks === horizon).map(metric => methodLabel(data, metric.baseline_id)))].join(", ")}</dd></div></dl>
            <p>Retrospective evaluation uses earlier reported observations. Historical capture dates do not establish real-time availability. Last-origin extrapolations have no observed target score and are not a current outlook.</p>
            <h3>Prediction intervals and training observations</h3>
            <div className={styles.table} tabIndex={0}><table><caption>Central prediction intervals for {date(prediction.target)}</caption><thead><tr><th scope="col">Level</th><th scope="col">Lower</th><th scope="col">Upper</th></tr></thead><tbody>{prediction.intervals.map(interval => <tr key={interval.level}><th scope="row">{interval.level * 100}%</th><td>{number(interval.lower)}</td><td>{number(interval.upper)}</td></tr>)}</tbody></table></div><p>The values list identifies each training observation and the held-out target, with its source and capture date.</p>
            <Method data={data} id={displayedModel} /><Method data={data} id="wis" />
            <h3>Sources</h3><SourceLinks data={data} ids={series.source_ids} />
          </div>
        </AtlasScope></div></div> : <p className={styles.notice}>No eligible origin for this model and horizon.</p>}
      </section>
      <section className={styles.countChecks} aria-label="Count checks">
        <ForecastChart checks series={series} index={index} prediction={undefined} modelLabel="" active={false} onHighlight={highlightPrediction} activeObservation={activeObservation} onObservation={highlightObservation} onReport={onReport} />
        <div className={styles.figureSummary}><dl className={styles.numbers}><div><dt>Checked</dt><dd>{index.checksById.size}</dd></div><div><dt>Above threshold</dt><dd>{index.aboveThreshold}</dd></div></dl><div className={styles.figureHelp}><AtlasScope label="Count check details" title={series.label}><div className="atlas-literature"><p>Reported counts are compared with the baseline expectation and its one-week 95th predictive quantile. Counts above that threshold are prompts for investigation, not evidence of an outbreak on their own.</p><p>The observations pane retains expected counts, thresholds, check origins and source evidence. Changing the prediction model does not change these archived checks.</p><Method data={data} id="count_exceedance" /></div></AtlasScope></div></div>
      </section>
      <div className={styles.evaluationDetails}>
      <section className={styles.detailPanel} aria-label="Observations and sources" onFocusCapture={() => { setHovered(null); setFocused(null); }}>
        <header className={styles.detailHeading}><h3><ChartNoAxesCombined size={14} aria-hidden />Observations</h3><span>{index.observations.length} source entries</span></header>
        <div ref={observationEntries} className={styles.observationDetails} role="region" aria-label="Observation details" tabIndex={0}>
        <div className="atlas-observation-values" role="group" aria-label="Values & sources">{index.observations.map(item => {
          const check = index.checksById.get(item.measure_id);
          const training = trainingIds.has(item.measure_id);
          const heldOut = item.measure_id === backtest?.target_measure_id;
          return <article key={item.measure_id} className={styles.checkedObservation} data-entry-id={item.measure_id} data-training={training} data-held-out={heldOut} data-selected={activeObservation === item.measure_id} onPointerMove={() => setHoveredObservation(item.measure_id)} onPointerLeave={() => setHoveredObservation(null)}>
            <ObservationRow measure={measures.get(item.measure_id)!} onReport={onReport} highlighted={activeObservation === item.measure_id} onHover={setHoveredObservation} onFocus={setFocusedObservation} publication />
            <div className={styles.observationContext}><span>Captured {date(item.capture)}</span>{training && <span>Training</span>}{heldOut && <span>Held out</span>}</div>
            {check && <dl className={styles.checkValues} data-exceeded={check.above_threshold}><div><dt>Expected</dt><dd>{number(check.expected)}</dd></div><div><dt>Threshold</dt><dd>{number(check.threshold)}</dd></div><div><dt>Check origin</dt><dd>{date(check.origin)}</dd></div><div><dt>Result</dt><dd>{check.above_threshold ? "Above threshold" : "Not exceeded"}</dd></div></dl>}
          </article>;
        })}</div>
        </div>
      </section>
      <section className={styles.detailPanel} aria-label="Model performance">
        <header className={styles.detailHeading}><h3><Gauge size={14} aria-hidden />Performance</h3><span>Hindcast · {horizon}-week horizon</span></header>
        <div className={styles.performanceFrame}><div ref={entries} id={performanceId} className={styles.performanceCards} role="group" aria-label="Model comparisons" tabIndex={0}>{series.metrics.filter(metric => metric.horizon_weeks === horizon).map(metric => <article key={metric.model_id} className={styles.performanceCard} aria-label={methodLabel(data, metric.model_id)} data-entry-id={metric.model_id} data-selected={metric.model_id === displayedModel} data-active={metric.model_id === activeModel} onPointerMove={() => setHovered(metric.model_id)} onPointerLeave={() => setHovered(null)} onFocus={() => { setFocused(metric.model_id); setHovered(null); }} onBlur={() => setFocused(null)}>
          <button className={styles.modelChoice} aria-pressed={metric.model_id === model} onClick={() => chooseModel(metric.model_id)}>{methodLabel(data, metric.model_id)}</button>
          <dl className={styles.modelTargets}><dt>Targets</dt><dd>{metric.n}</dd></dl>
          <dl className={styles.modelScores}><div><dt>MAE</dt><dd>{number(metric.mae, 3)}</dd></div><div><dt>WIS</dt><dd>{number(metric.wis, 3)}</dd></div><div><dt><abbr title="Relative weighted interval score">Rel. WIS</abbr></dt><dd>{number(metric.relative_wis, 3)}</dd></div></dl>
          <dl className={styles.modelCoverage}>{[.5, .8, .95].map(level => { const coverage = metric.coverage.find(item => item.level === level); return <div key={level}><dt>{level * 100}% coverage</dt><dd>{coverage ? `${number(coverage.value * 100)}%` : "Not reported"}</dd></div>; })}</dl>
        </article>)}</div><button className="atlas-scroll-cue" data-more={moreModels} tabIndex={moreModels ? 0 : -1} aria-hidden={!moreModels} aria-label="More models below" title="More models below" aria-controls={performanceId} onClick={() => entries.current?.scrollBy({ top: entries.current.clientHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}><ChevronsDown size={18} aria-hidden /></button></div>
      </section>
      </div>
    </div>
  </div>;
}

function ForecastChart({ checks = false, series, index, prediction, modelLabel, active, onHighlight, activeObservation, onObservation, onReport }: { checks?: boolean; series: IntelligenceSeries; index: ReturnType<typeof forecastSeriesIndex>; prediction: IntelligenceForecast | IntelligenceBacktest | undefined; modelLabel: string; active: boolean; onHighlight: (active: boolean) => void; activeObservation: string | null; onObservation: (id: string | null, focus?: boolean) => void; onReport: (ids: string[]) => void }) {
  const { ref, size } = useElementSize<SVGSVGElement>();
  const width = size?.width ?? 700, height = size?.height ?? 280;
  const right = width - 40, bottom = height - 24;
  const history = checks ? index.observations.filter(item => index.checksById.has(item.measure_id)) : index.observations;
  if (!history.length) return <p className={styles.notice}>No eligible checks for this series.</p>;
  const actual = prediction && "observed" in prediction ? prediction.observed : null;
  const start = Date.parse(history[0].date), end = Math.max(Date.parse(history.at(-1)!.date), prediction ? Date.parse(prediction.target) : -Infinity);
  const maximum = Math.max(1, ...history.map(item => item.value), ...(prediction?.intervals.map(item => item.upper) ?? []), prediction?.central ?? 0, ...(checks ? [...index.checksById.values()].flatMap(item => [item.expected, item.threshold]) : []));
  const x = (value: string) => 48 + (end === start ? .5 : (Date.parse(value) - start) / (end - start)) * (right - 48);
  const y = (value: number) => bottom - value / maximum * (bottom - 18);
  const target = prediction && "target_measure_id" in prediction ? index.observationsById.get(prediction.target_measure_id) : undefined;
  const preceding = prediction && history.filter(item => item.date < prediction.target).at(-1);
  const following = prediction && history.find(item => item.date > prediction.target);
  const predictionLeft = prediction ? Math.max(x(prediction.target) - 18, preceding ? (x(preceding.date) + x(prediction.target)) / 2 : 36) : 0;
  const predictionRight = prediction ? Math.min(x(prediction.target) + 18, following ? (x(following.date) + x(prediction.target)) / 2 : width - 20) : 0;
  const predictionWidth = prediction ? 2 * Math.max(0, Math.min(x(prediction.target) - predictionLeft, predictionRight - x(prediction.target))) : 0;
  function observationPoint(item: IntelligenceSeries["observations"][number], position: number) {
    const left = position ? (x(history[position - 1].date) + x(item.date)) / 2 : 36;
    const right = position + 1 < history.length ? (x(item.date) + x(history[position + 1].date)) / 2 : x(item.date) + 18;
    const check = checks ? index.checksById.get(item.measure_id) : undefined;
    const selected = activeObservation === item.measure_id;
    const heldOut = item.measure_id === target?.measure_id;
    return <m.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={item.measure_id} className={styles.observationPoint} data-entry-id={item.measure_id} data-selected={selected} role="button" tabIndex={0} aria-label={`${date(item.date)}: ${number(item.value)}${heldOut ? ", held-out count" : ""}${check ? `, expected ${number(check.expected)}, threshold ${number(check.threshold)}, ${check.above_threshold ? "above threshold" : "not exceeded"}` : ""}. View report`}
      onPointerMove={() => onObservation(item.measure_id)} onPointerLeave={() => onObservation(null)} onFocus={() => onObservation(item.measure_id, true)} onBlur={() => onObservation(null, true)} onClick={() => onReport([item.record_id])} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onReport([item.record_id]); } }}>
      <line className={styles.checkGuide} x1={x(item.date)} x2={x(item.date)} y1="14" y2={bottom} />
      <m.rect initial={false} className={styles.observationHit} animate={{ x: left, y: heldOut ? y(item.value) - 12 : 14, width: Math.max(0, right - left), height: heldOut ? 24 : Math.max(0, bottom - 14) }} rx="3" />
      {check && <>
        <m.line initial={false} className={styles.thresholdMark} animate={{ x1: x(item.date) - 4, x2: x(item.date) + 4, y1: y(check.threshold), y2: y(check.threshold) }} />
        <m.circle initial={false} className={styles.expectedPoint} animate={{ cx: x(item.date), cy: y(check.expected) }} r="3" />
      </>}
      {heldOut ? <m.path initial={false} animate={{ d: `M${x(item.date)} ${y(item.value) - 6}l6 6-6 6-6-6Z` }} className={styles.actualPoint} /> : <m.circle initial={false} animate={{ cx: x(item.date), cy: y(item.value), r: selected ? 5 : 3 }} className={styles.historyPoint} />}
      <title>{date(item.date)}: {number(item.value)}{check ? ` · Expected ${number(check.expected)} · Threshold ${number(check.threshold)}` : ""}</title>
    </m.g>;
  }
  return <figure className={styles.chart} data-model-active={checks ? undefined : active}>
    <svg ref={ref} className={styles.predictionSvg} viewBox={`0 0 ${width} ${height}`} role="group" aria-label={checks ? `${series.label}: reported counts, expected counts and investigation thresholds` : prediction ? `Reported counts; training through ${date(prediction.origin)}, ${prediction.horizon_weeks}-week prediction for ${date(prediction.target)}. Central estimate ${number(prediction.central)}${actual === null ? ". Target not evaluated." : `; held-out count ${number(actual)}.`}` : `${series.label}: reported counts`}>
      {[0, maximum / 2, maximum].map(tick => <g key={tick}><line x1="48" x2={width - 20} y1={y(tick)} y2={y(tick)} className={styles.gridLine} /><text x="40" y={y(tick) + 4} textAnchor="end">{number(tick)}</text></g>)}
      {prediction && <line x1={x(prediction.origin)} x2={x(prediction.origin)} y1="14" y2={bottom} className={styles.originLine} />}
      <AnimatePresence initial={false}>{!checks && history.slice(1).map((item, index) => {
        const previous = history[index];
        return previous.segment === item.segment && <m.line key={`${previous.measure_id}:${item.measure_id}`} initial={{ opacity: 0 }} animate={{ opacity: 1, x1: x(previous.date), y1: y(previous.value), x2: x(item.date), y2: y(item.value) }} exit={{ opacity: 0 }} className={styles.historyLine} />;
      })}</AnimatePresence>
      <AnimatePresence initial={false}>{history.map((item, index) => item !== target && observationPoint(item, index))}</AnimatePresence>
      {prediction && <g onPointerMove={() => onHighlight(true)} onPointerLeave={() => onHighlight(false)}>
        <m.rect initial={false} className={styles.predictionBand} animate={{ x: x(prediction.target) - predictionWidth / 2, width: predictionWidth, height: Math.max(0, bottom - 14) }} y="14" rx="4" />
        <rect fill="transparent" x={predictionLeft} y="14" width={Math.max(0, predictionRight - predictionLeft)} height={Math.max(0, bottom - 14)} />
        {prediction.intervals.slice().sort((a, b) => b.level - a.level).map((interval, index) => <m.rect initial={false} key={interval.level} animate={{ x: x(prediction.target) - (22 - index * 6) * predictionWidth / 72, width: (22 - index * 6) * predictionWidth / 36, y: y(interval.upper), height: Math.max(1, y(interval.lower) - y(interval.upper)) }} rx="2" className={styles.interval} data-level={interval.level}><title>{interval.level * 100}% interval: {number(interval.lower)}–{number(interval.upper)}</title></m.rect>)}
        <m.circle initial={false} animate={{ cx: x(prediction.target), cy: y(prediction.central) }} r="5" className={styles.predictionPoint} />
      </g>}
      {target && observationPoint(target, history.indexOf(target))}
      <text x="48" y={height - 8}>{date(history[0].date)}</text><text x={right} y={height - 8} textAnchor="end">{date(new Date(end).toISOString().slice(0, 10))}</text>
      {prediction && <text x={x(prediction.origin) - 5} y="10" textAnchor="end">Origin · {date(prediction.origin)}</text>}
    </svg>
    <figcaption className={styles.forecastLegend}><span><i className={styles.historyKey} />Reported</span>{checks && <><span><i className={styles.expectedKey} />Expected</span><span><i className={styles.thresholdKey} />Investigation threshold</span></>}{prediction && <button className={styles.predictionLegend} onPointerMove={() => onHighlight(true)} onPointerLeave={() => onHighlight(false)} onFocus={() => onHighlight(true)} onBlur={() => onHighlight(false)} onClick={() => onHighlight(true)}><i className={styles.predictionKey} /><span className={styles.legendModel} title={modelLabel}>{modelLabel}</span><span> · 50 / 80 / 95% intervals</span></button>}{actual !== null && <span><i className={styles.actualKey} />Held-out count</span>}</figcaption>
  </figure>;
}
