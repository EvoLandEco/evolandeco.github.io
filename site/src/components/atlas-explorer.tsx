"use client";
import { dailySelection, pendingDailyDocuments, reportChronology, highlightedReportIds, type DailyState, type DailyDocument, type DailySelection } from "@/lib/atlas-daily";
import { DailyReport, DailyProcessing, DailyVersion } from "./atlas-daily";
import { SourceQuotation, OriginalTitle } from "./atlas-source-text";
import type { AtlasExperiment } from "@/lib/atlas-intelligence";
import type { AtlasRelease } from '@/lib/atlas-release';
import { atlasUI } from "@/lib/atlas-ui";
import { EvidenceSummary } from "./atlas-evidence-summary";
import { ReportSourceAssessments } from "./atlas-report-assessments";
import { AtlasDisclosure } from "./atlas-disclosure";
import { AtlasDetailStatus, useAtlasDetails } from "./atlas-detail";
import { memo, useCallback, useId, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type MouseEvent } from "react";
import { flushSync } from "react-dom";
import { Building2, SlidersHorizontal, GitBranch, ShieldCheck, FlaskConical, HeartHandshake, Maximize2, Minimize2, ChartNoAxesCombined, Activity, ArrowRight, CalendarDays, ChevronRight, ArrowLeftRight, MapPin, Download, ExternalLink, FileText, Globe2, Info, Network, RefreshCw, RotateCcw, ScanLine, TriangleAlert, ChevronDown, ChevronsUp, X } from "lucide-react";
import { groupGeographicLinks, dayDate, dayNumber, monthsBefore, formatDate, linkLabels, supported, topicIds, reportsPerPage, type AtlasRecord, type AtlasTrack, type AtlasLink, type AtlasAssessment, type DateBasis } from "@/lib/atlas";
import { Globe, type GlobeLink, type GlobeHover, type GlobeAnchor } from "./magicui/globe";
import { GlobeDragHint } from "./magicui/globe-navigation";
import { AuroraText } from "./magicui/aurora-text";
import { Settings, usePanelMotion } from "./motion-policy";
import { useAtlasNavigation } from "./atlas-navigation";

import { useMotionValue, useMotionValueEvent, type MotionValue } from "motion/react";
import { ReportPagination } from "./atlas-pagination";
import { AtlasSelect } from "./atlas-select";
import { reportingFacets } from "@/lib/atlas-reporting-filters";
import { AtlasScope } from "./atlas-scope";
import { CountryText, ReportCountryFlags, LocationBadges, LocationSymbol } from "./atlas-location-badges";
import { BeamStroke, BeamGradientStops } from "./magicui/animated-beam";
import Image from "next/image";
import dynamic from "next/dynamic";
const AtlasOneHealth = dynamic(() => import("./atlas-one-health").then(module => module.AtlasOneHealth), { loading: () => <div className="atlas-panel-loading" role="status"><div className="atlas-panel-loading-content"><span className="atlas-panel-loading-mark" aria-hidden><HeartHandshake size={30} strokeWidth={1.5} /></span><strong>Loading One Health</strong><span>Preparing observations and source evidence…</span></div></div> });
import { AtlasNetworkOverview } from "./atlas-network-overview";
import { AtlasChains } from "./atlas-chains";
import { AtlasTrends } from "./atlas-trends";
import { MetricFigures, ObservationHistory } from "./atlas-metrics";
import { SourceComparisons, ComparisonBadge } from "./atlas-comparisons";
import { useAtlas, AtlasWorkspaceContext, AtlasPanelStateContext, useAtlasPanelState } from "./atlas-context";

const AtlasUndatedSources = dynamic(() => import("./atlas-undated-sources"));
const AtlasAnalysis = dynamic(() => import("./atlas-analysis").then(module => module.AtlasAnalysis));
const AtlasRiskAssessments = dynamic(() => import("./atlas-analysis").then(module => module.AtlasRiskAssessments));
const evidenceTabs = [ ["trends", "Trends", ChartNoAxesCombined], ["analysis", "Analysis", FlaskConical], ["links", "Geographic links", Globe2], ["one-health", "One Health", HeartHandshake], ["reports", "Reports", FileText] ] as const;
type Tab = typeof evidenceTabs[number][0];
const reportViews = [["reports", "Reports", FileText], ["assessments", "Assessments", ScanLine], ["sources", "Source coverage", Network]] as const;
type ReportView = typeof reportViews[number][0];
function keepHeadingVisible(heading: HTMLElement) {
  requestAnimationFrame(() => {
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: "nearest", behavior: "instant" });
  });
}

function collapseEntry(event: MouseEvent<HTMLButtonElement>) {
  const entry = event.currentTarget.closest("article")!;
  const heading = entry.querySelector<HTMLElement>(".atlas-entry-heading")!;
  entry.querySelectorAll("details[open]").forEach(detail => detail.removeAttribute("open"));
  keepHeadingVisible(heading);
}

function Evidence({ support, onReport }: { support: (string | number)[][]; onReport: (ids: string[]) => void }) {
  const { sourceName } = useAtlas();
  const { data, error, retry } = useAtlasDetails([...new Set(support.map(([id]) => String(id)))].map(id => ({ collection: "map.records", id })));
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  return <div className="atlas-evidence">{support.map(([id, index]) => {
    const record = data.get("map.records", String(id));
    const claim = record.claims.find(c => c.claim_index === index);
    if (!claim) throw new Error("ATLAS source claim is missing");
    return <div key={`${id}:${index}`}><a href={record.url} target="_blank" rel="noopener noreferrer">{sourceName(record.source)} · {formatDate(record.publication)} <ExternalLink size={13} aria-hidden /></a>
      <p>{claim.text}</p>{claim.quotes.map((quote, i) => <SourceQuotation key={i} quote={quote} recordId={record.id} claimIndex={claim.claim_index} quoteIndex={i} />)}<button onClick={() => onReport([record.id])}>View report <ArrowRight size={13} aria-hidden /></button></div>;
  })}</div>;
}

export function AtlasExplorer({ downloadRoot, release, experiment, daily = {} }: { downloadRoot: string; release: AtlasRelease; experiment: AtlasExperiment; daily?: DailyState }) {
  const { sourceName, atlasDocuments, bundle, atlas, mapLocations, dateBounds, windowRecords, reportDocuments, lookup, tracks, countriesForLink, metrics, selectedResearch } = useAtlas();
  const tabs = evidenceTabs;
  const [panelStates] = useState(() => new Map<string, unknown>());
  const reportTabs = reportViews;
  const { arriving } = useAtlasNavigation();
  const panel = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const workspaceScroll = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = toolbar.current;
    if (!element) return;
    const resize = new ResizeObserver(() => element.parentElement?.style.setProperty("--atlas-toolbar-height", `${element.getBoundingClientRect().height}px`));
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  const rulesMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (rulesMenu.current && !rulesMenu.current.contains(event.target as Node)) rulesMenu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const entrance = useRef<HTMLButtonElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const [pageHeight, setPageHeight] = useState(0);
  const viewTransition = useRef<ViewTransition | null>(null);
  const [wide, setWide] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [dragHint, setDragHint] = useState<number | null>(0);
  const [surfaceHover, setSurfaceHover] = useState(false);
  useEffect(() => {
    const query = matchMedia("(min-width: 1180px)");
    const resize = () => { setWide(query.matches); if (!query.matches) { setFullscreen(false); setSurfaceHover(false); } };
    resize(); query.addEventListener("change", resize);
    return () => query.removeEventListener("change", resize);
  }, []);
  useLayoutEffect(() => {
    if (!fullscreen || !page.current) return;
    const element = page.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const outside: [HTMLElement, boolean][] = [];
    let branch: HTMLElement = page.current;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) if (sibling !== branch && sibling instanceof HTMLElement) {
        outside.push([sibling, sibling.inert]); sibling.inert = true;
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }
    exit.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      outside.forEach(([element, inert]) => { element.inert = inert; });
      requestAnimationFrame(() => element.querySelector<HTMLButtonElement>(".atlas-fullscreen-entrance")?.focus({ preventScroll: true }));
    };
  }, [fullscreen]);
  useEffect(() => () => {
    viewTransition.current?.skipTransition();
    delete document.documentElement.dataset.atlasWorkspaceTransition;
  }, []);
  function changeFullscreen(value: boolean) {
    if (value === fullscreen || value && (!wide || arriving)) return;
    const height = page.current?.offsetHeight ?? 0;
    const update = () => { if (value) setPageHeight(height); setSurfaceHover(false); setFullscreen(value); setDragHint(current => value ? (current ?? 0) + 1 : null); };
    viewTransition.current?.skipTransition();
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
    document.documentElement.dataset.atlasWorkspaceTransition = "active";
    const transition = document.startViewTransition(() => { flushSync(update); });
    viewTransition.current = transition;
    const finish = () => { if (viewTransition.current === transition) { delete document.documentElement.dataset.atlasWorkspaceTransition; viewTransition.current = null; } };
    void transition.finished.then(finish, finish);
  }
  function onGlobeSurface(event: React.MouseEvent<HTMLDivElement>) {
    const canvas = event.currentTarget.querySelector("canvas");
    if (!canvas || event.target !== canvas) return false;
    const box = canvas.getBoundingClientRect();
    return Math.hypot((event.clientX - box.left) / box.width - .5, (event.clientY - box.top) / box.height - .5) < .38;
  }
  function overSurface(event: React.PointerEvent<HTMLDivElement>) {
    setSurfaceHover(wide && !fullscreen && !event.buttons && onGlobeSurface(event));
  }
  const legendBeamId = useId();
  const motion = usePanelMotion(panel, true);
  const basis = "publication";
  const [window, setWindow] = useState<[string, string]>(() => [...dateBounds("publication")]);
  const [preset, setPreset] = useState<number | null>(3);
  const [topic, setTopic] = useState<string[]>([]);
  const [places, setPlaces] = useState<string[]>([]);
  const [diseases, setDiseases] = useState<string[]>([]);
  const [includeContext, setIncludeContext] = useState(false);
  const [source, setSource] = useState<string[]>([]);
  const [kind, setKind] = useState<string[]>([]);
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null);
  const [tab, setTab] = useState<Tab>("trends");
  const [reportView, setReportView] = useState<ReportView>("reports");
  useLayoutEffect(() => {
    const workspace = toolbar.current?.parentElement;
    const tools = workspace?.querySelector<HTMLElement>(".atlas-report-tools");
    if (!workspace || !tools) return;
    const measure = () => workspace.style.setProperty("--atlas-report-tools-height", `${tools.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(tools);
    return () => { observer.disconnect(); workspace.style.removeProperty("--atlas-report-tools-height"); };
  }, [tab, reportView]);
  const showingReports = tab === "reports" && reportView === "reports";
  const [assessmentKind, setAssessmentKind] = useState("relationships");
  const showingAssessments = tab === "reports" && reportView === "assessments";
  const showingRelationships = showingAssessments && assessmentKind === "relationships";
  const showingSources = tab === "reports" && reportView === "sources";
  const [analysisSeries, setAnalysisSeries] = useState("");
  const [healthReport, setHealthReport] = useState("");
  const [riskRecord, setRiskRecord] = useState("");
  function changeReportView(next: ReportView) {
    setReportView(next);
    setReportJump(undefined);
    workspaceScroll.current?.scrollTo({ top: 0 });
  }
  function changeTab(next: Tab) {
    setTab(next);
    if (fullscreen) workspaceScroll.current?.scrollTo({ top: 0 });
  }
  const [selectedLink, setSelectedLink] = useState("");
  const [selectedPoint, setSelectedPoint] = useState("");
  const [reportEvidence, setReportEvidence] = useState<{ recordIds: string[]; documentIds: string[] }>({ recordIds: [], documentIds: [] });
  const hasReportEvidence = !!(reportEvidence.recordIds.length || reportEvidence.documentIds.length);
  const [reportPage, setReportPage] = useState({ scope: "", index: 0 });
  const [reportJump, setReportJump] = useState<{ documentId: string | null; headingId?: string; expand?: boolean }>();
  const clearReportEvidence = useCallback(() => {
    setReportEvidence({ recordIds: [], documentIds: [] });
    setReportJump(undefined);
  }, []);
  const [entryPages, setEntryPages] = useState({ scope: "", links: 0, assessments: 0, sources: 0 });
  const [hover, setHover] = useState<GlobeHover>(null);
  const calloutPoint = useMotionValue<GlobeAnchor>(null);
  const moveCallout = useCallback((point: GlobeAnchor) => calloutPoint.set(point), [calloutPoint]);
  const [focus, setFocus] = useState<[number, number]>();
  const [weeklyMin, weeklyMax] = useMemo(() => dateBounds(basis), [dateBounds, basis]);
  const min = daily.data && daily.data.publication_from < weeklyMin ? daily.data.publication_from : weeklyMin;
  const max = daily.data && daily.data.publication_until > weeklyMax ? daily.data.publication_until : weeklyMax;
  const [knownBounds, setKnownBounds] = useState([min, max]);
  if (knownBounds[0] !== min || knownBounds[1] !== max) {
    setKnownBounds([min, max]);
    setWindow([window[0] === knownBounds[0] ? min : window[0], window[1] === knownBounds[1] ? max : window[1]]);
  }
  const dailyExcluded = !!(diseases.length || topic.length || kind.length || reportEvidence.recordIds.length);
  const dailyView = useMemo(() => daily.data && !dailyExcluded ? dailySelection(daily.data, window, source, places) : undefined, [daily.data, dailyExcluded, window, source, places]);
  const dailyDocuments = useMemo(() => dailyView ? pendingDailyDocuments(dailyView, new Set(bundle.records.map(row => row.id))) : [], [dailyView, bundle]);
  const sourceChoices = useMemo(() => {
    const choices = new Map(atlas.records.map(row => [row.source, sourceName(row.source)]));
    for (const row of daily.data?.source_coverage ?? []) choices.set(bundle.channels.find(channel => channel.acquisition_source === row.source_id)?.id ?? row.source_id, row.source_name);
    return [...choices].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [atlas.records, sourceName, daily.data, bundle.channels]);
  const sourceLabel = (id: string) => sourceChoices.find(item => item.value === id)?.label ?? sourceName(id);
  const globeLayout = useMemo<GlobeLink[]>(() => groupGeographicLinks(atlas.map_links, lookup).map(group => {
    const link = group.entries.at(-1)!.link;
    return { id: link.id, groupId: group.id, label: link.label, type: link.type, directed: link.directed,
      from: [link.from.lat, link.from.lon], to: [link.to.lat, link.to.lon] };
  }), [atlas.map_links, lookup]);
  const rows = useMemo(() => windowRecords(window[0], window[1], basis), [window, basis, windowRecords]);
  const facets = useMemo(() => reportingFacets(bundle, rows, { places, diseases, topics: topicIds(topic), sources: source, includeContext }), [bundle, rows, places, diseases, topic, source, includeContext]);
  const placeChoices = useMemo(() => {
    const choices = new Map(facets.places.map(item => [item.value, item]));
    const regions = new Intl.DisplayNames(["en"], { type: "region" });
    for (const doc of daily.data?.documents ?? []) for (const code of doc.country_codes) if (!choices.has(code)) choices.set(code, { value: code, label: regions.of(code)!, count: 0, searchText: code });
    return [...choices.values()];
  }, [facets.places, daily.data]);
  const filtered = facets.rows;
  const supportedRows = filtered;
  const recordIds = useMemo(() => new Set(supportedRows.map(r => r.id)), [supportedRows]);
  const activeTracks = useMemo(() => new Set(filtered.map(r => r.track)), [filtered]);
  const eligibleLinks = useMemo(() => atlas.map_links.filter(l => supported(l.support, recordIds) && (!kind.length || kind.includes(l.type))
    && (!topic.length || topicIds(topic).some(id => l.from.track === id || l.to.track === id)) && (!source.length || l.support.some(([id]) => source.includes(lookup.get(String(id))!.source)))), [atlas.map_links, recordIds, kind, topic, source, lookup]);
  const chains = useMemo(() => selectedResearch(recordIds).reviewed_chains, [selectedResearch, recordIds]);
  const linkGroups = useMemo(() => groupGeographicLinks(eligibleLinks, lookup), [eligibleLinks, lookup]);
  const links = useMemo(() => linkGroups.map(group => (group.entries.find(e => e.link.id === selectedLink) ?? group.entries.at(-1)!).link), [linkGroups, selectedLink]);
  const assessments = useMemo(() => atlas.relationships.filter(a => supported(a.support, recordIds) && (!topic.length || topicIds(topic).includes(a.track))
    && (!source.length || a.support.some(([id]) => source.includes(lookup.get(id)!.source)))), [atlas.relationships, recordIds, topic, source, lookup]);
  const reportRelationships = useMemo(() => {
    const entries = new Map<string, AtlasAssessment[]>();
    for (const assessment of assessments) {
      const support = [...assessment.support, ...(assessment.updates ?? []).filter(update => supported(update.support, recordIds)).flatMap(update => update.support)];
      for (const id of new Set(support.map(([id]) => id))) {
        const related = entries.get(id) ?? [];
        related.push(assessment);
        entries.set(id, related);
      }
    }
    return entries;
  }, [assessments, recordIds]);
  const riskRecords = useMemo(() => new Set(experiment?.data?.risk_profiles.map(profile => profile.record_id)), [experiment]);
  const documents = useMemo(() => reportChronology(reportDocuments(filtered, basis, topic, source), dailyDocuments, id => atlasDocuments.get(id)!), [filtered, basis, topic, source, reportDocuments, dailyDocuments, atlasDocuments]);
  const facetScope = [places, diseases, includeContext];
  const reportScope = JSON.stringify([basis, window, topic, source, ...facetScope]);
  const entryScope = JSON.stringify([reportScope, kind]);
  if (entryPages.scope !== entryScope) setEntryPages({ scope: entryScope, links: 0, assessments: 0, sources: 0 });
  const linkPageCount = Math.max(1, Math.ceil(links.length / reportsPerPage));
  const assessmentPageCount = Math.max(1, Math.ceil(assessments.length / reportsPerPage));
  const linkPageIndex = entryPages.scope === entryScope ? Math.min(entryPages.links, linkPageCount - 1) : 0;
  const assessmentPageIndex = entryPages.scope === entryScope ? Math.min(entryPages.assessments, assessmentPageCount - 1) : 0;
  const linkPageItems = Array.from({ length: linkPageCount }, (_, i) => ({ value: String(i), label: `Page ${i + 1} of ${linkPageCount}` }));
  const assessmentPageItems = Array.from({ length: assessmentPageCount }, (_, i) => ({ value: String(i), label: `Page ${i + 1} of ${assessmentPageCount}` }));
  const coverageTopics = useMemo(() => atlas.tracks.filter(t => activeTracks.has(t.id)), [atlas.tracks, activeTracks]);
  const sourcePageCount = Math.max(1, Math.ceil(coverageTopics.length / 24));
  const sourcePageIndex = entryPages.scope === entryScope ? Math.min(entryPages.sources, sourcePageCount - 1) : 0;
  const sourcePageTopics = useMemo(() => coverageTopics.slice(sourcePageIndex * 24, (sourcePageIndex + 1) * 24), [coverageTopics, sourcePageIndex]);
  const sourcePageItems = Array.from({ length: sourcePageCount }, (_, i) => ({ value: String(i), label: `Topics ${i * 24 + 1}–${Math.min((i + 1) * 24, coverageTopics.length)} of ${coverageTopics.length}` }));
  const pageCount = Math.max(1, Math.ceil(documents.length / reportsPerPage));
  const pageIndex = reportPage.scope === reportScope ? Math.min(reportPage.index, pageCount - 1) : 0;
  if (reportPage.scope !== reportScope) setReportPage({ scope: reportScope, index: 0 });
  const pageDocuments = documents.slice(pageIndex * reportsPerPage, (pageIndex + 1) * reportsPerPage);
  const evidence = useMemo(() => highlightedReportIds(documents, reportEvidence.recordIds, reportEvidence.documentIds), [documents, reportEvidence]);
  const pageItems = Array.from({ length: pageCount }, (_, index) => {
    const matches = documents.slice(index * reportsPerPage, (index + 1) * reportsPerPage).filter(entry => evidence.has(entry.id)).length;
    return { value: String(index), label: `Page ${index + 1} of ${pageCount}${matches ? ` · ${matches} relevant` : ""}` };
  });
  const contextNodes = useMemo(() => {
    const selected = filtered;
    return mapLocations(selected, selectedResearch(source.length ? new Set(selected.map(r => r.id)) : recordIds));
  }, [filtered, mapLocations, source, selectedResearch, recordIds]);
  const globeNodes = useMemo(() => {
    if (!topic.length && !kind.length) return contextNodes;
    const topics = new Set(topicIds(topic));
    const endpoints = new Set(links.flatMap(link => [`${link.from.lat},${link.from.lon}`, `${link.to.lat},${link.to.lon}`]));
    return contextNodes.filter(node => endpoints.has(node.location.join(",")) || (!kind.length && node.topics.some(id => topics.has(id))));
  }, [contextNodes, topic, kind, links]);
  const globeLinks = useMemo<GlobeLink[]>(() => links.map((l, index) => ({ id: l.id, label: l.label, type: l.type, directed: l.directed,
    count: linkGroups[index].entries.length, groupId: linkGroups[index].id, from: [l.from.lat, l.from.lon], to: [l.to.lat, l.to.lon] })), [links, linkGroups]);
  const selectedNode = globeNodes.find(n => n.id === selectedPoint);
  const calloutTarget = useMemo<GlobeHover>(() => hover ?? (selectedLink && globeLinks.some(l => l.id === selectedLink)
    ? { kind: "link", id: selectedLink } : selectedNode ? { kind: "node", id: selectedNode.id } : null), [hover, selectedLink, selectedNode, globeLinks]);
  const calloutNode = calloutTarget?.kind === "node" ? globeNodes.find(n => n.id === calloutTarget.id) : undefined;
  const calloutLink = calloutTarget?.kind === "link" ? atlas.map_links.find(l => l.id === calloutTarget.id) : undefined;
  const calloutGroup = calloutLink ? linkGroups.find(group => group.entries.some(e => e.link.id === calloutLink.id)) : undefined;
  const calloutReports = calloutNode ? (filtered).filter(r => calloutNode.records.includes(r.id) && (!source.length || source.includes(r.source))) : [];
  const calloutRecords = calloutLink ? calloutLink.support.flatMap(([id]) => { const record = lookup.get(String(id)); return record ? [record] : []; }) : calloutReports;
  const calloutDocumentCount = new Set(calloutRecords.map(r => r.document_id)).size;
  const calloutLatest = calloutRecords.map(r => r[basis]).sort().at(-1);
  const calloutEndpoints = calloutLink ? countriesForLink(calloutLink) : [];
  const rangeDays = dayNumber(max) - dayNumber(min);
  const startPercent = rangeDays ? (dayNumber(window[0]) - dayNumber(min)) / rangeDays * 100 : 0;
  const endPercent = rangeDays ? (dayNumber(window[1]) - dayNumber(min)) / rangeDays * 100 : 100;
  useLayoutEffect(() => {
    if (!reportJump) return;
    const target = reportJump.documentId ? document.getElementById(`atlas-report-${reportJump.documentId}`) : document.getElementById(reportJump.headingId ?? "atlas-report-heading");
    if (reportJump.expand && target instanceof HTMLDetailsElement) target.open = true;
    (target?.querySelector<HTMLElement>("summary") ?? target)?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const animations = motion.matches ? [] : [...page.current!.querySelectorAll('.atlas-report[data-evidence="true"] > summary')].map(heading =>
      heading.animate([{ opacity: .35 }, { opacity: 1, offset: .45 }, { opacity: .35 }], {
        id: "atlas-evidence-pulse", pseudoElement: "::after", duration: 1150, iterations: 3, easing: "ease-in-out",
      }));
    const stop = () => animations.forEach(animation => animation.cancel());
    motion.addEventListener("change", stop);
    return () => { motion.removeEventListener("change", stop); stop(); };
  }, [reportJump]);
  const chooseTopic = useCallback((id: string | string[], view?: Tab) => {
    clearReportEvidence();
    setTopic(topicIds(id)); setSelectedLink(""); setHover(null); setTab(view ?? "reports");
    if (view === undefined) setReportView("reports");
    const points = contextNodes.filter(n => n.topics.some(t => topicIds(id).includes(t)));
    setSelectedPoint(points.length === 1 ? points[0].id : "");
    setFocus(points.length === 1 ? points[0].location : undefined);
  }, [contextNodes, setReportView, setTab, clearReportEvidence]);
  function choosePoint(id: string) {
    const point = globeNodes.find(n => n.id === id);
    if (!point) return;
    if (!point.topics.length) { if (point.links.length) chooseLink(point.links[0]); return; }
    chooseTopic(`place:${point.topics.join(",")}`);
    setSelectedPoint(id); setFocus(point.location);
  }
  const chooseLink = useCallback((id: string) => {
    setHover(null);
    clearReportEvidence();
    setSelectedLink(id); setSelectedPoint(""); setTab("links");
    const index = linkGroups.findIndex(group => group.entries.some(e => e.link.id === id));
    if (index >= 0) setEntryPages(current => ({ ...current, scope: entryScope, links: Math.floor(index / reportsPerPage) }));
    const link = atlas.map_links.find(l => l.id === id);
    if (link) setFocus(current => current?.[0] === link.from.lat && current?.[1] === link.from.lon ? current : [link.from.lat, link.from.lon]);
  }, [linkGroups, entryScope, atlas.map_links, setTab, clearReportEvidence]);
  function reset() { setPlaces([]); setDiseases([]); setIncludeContext(false); setSelectedPoint(""); setTopic([]); setSource([]); setKind([]); setSelectedLink(""); setFocus(undefined); setHover(null); clearReportEvidence(); }
  function clearSelection() {
    if (selectedPoint) setTopic([]);
    setSelectedPoint(""); setSelectedLink(""); setFocus(undefined); setHover(null);
  }
  function clearRule(clear: () => void) {
    rulesMenu.current?.querySelector("summary")?.focus();
    clear();
  }
  function resetAll() {
    reset(); setWindow([min, max]); setPreset(3);
    setReportPage({ scope: "", index: 0 }); setEntryPages({ scope: "", links: 0, assessments: 0, sources: 0 });
  }
  function changeSource(value: string[]) {
    setSource(value); clearReportEvidence(); setSelectedLink(""); setSelectedPoint(""); setFocus(undefined); setHover(null);
  }
  function changeFacet(field: "places" | "diseases", value: string[]) {
    if (field === "places") setPlaces(value); else setDiseases(value);
    clearReportEvidence(); setSelectedLink(""); setSelectedPoint(""); setFocus(undefined); setHover(null);
  }
  function changeKind(value: string[]) {
    setKind(value); setSelectedLink(""); setHover(null); clearReportEvidence();
  }
  const topicLabel = topic.map(id => tracks.get(id)?.label).filter(Boolean).join(" / ");
  const activeFilters = [
    ...(places.length ? [{ key: "place", label: `Place · ${placeChoices.filter(item => places.includes(item.value)).map(item => item.label).join(", ")}`, clear: () => changeFacet("places", []) }] : []),
    ...(diseases.length ? [{ key: "disease", label: `Disease · ${facets.diseases.filter(item => diseases.includes(item.value)).map(item => item.label).join(", ")}`, clear: () => changeFacet("diseases", []) }] : []),
    ...(includeContext ? [{ key: "background locations", label: "Include background locations", clear: () => setIncludeContext(false) }] : []),
    ...(window[0] !== min || window[1] !== max ? [{ key: "dates", label: `${formatDate(window[0])} – ${formatDate(window[1])}`, clear: () => { changeWindow(min, max); setPreset(3); } }] : []),
    ...(topic.length ? [{ key: "topic", label: `Topic · ${topicLabel}`, summary: topic.length > 1 ? `Topics · ${topic.length} selected` : `Topic · ${topicLabel}`, clear: () => chooseTopic("", tab) }] : []),
    ...(source.length ? [{ key: "source", label: `Source · ${source.map(sourceLabel).join(", ")}`, summary: source.length > 1 ? `Sources · ${source.length} selected` : `Source · ${sourceLabel(source[0])}`, clear: () => changeSource([]) }] : []),
    ...(kind.length ? [{ key: "route type", label: `Routes · ${kind.map(value => linkLabels[value as keyof typeof linkLabels]).join(", ")}`, summary: kind.length > 1 ? `Routes · ${kind.length} selected` : `Routes · ${linkLabels[kind[0] as keyof typeof linkLabels]}`, clear: () => changeKind([]) }] : []),
  ];
  const ruleCount = activeFilters.length + Number(!!selectedLink) + Number(hasReportEvidence);
  function changeWindow(from: string, to: string) {
    if (!from || !to || from < min || to > max || from > to) return;
    setWindow([from, to]); setHover(null); setSelectedLink(""); setPreset(null); clearReportEvidence();
  }
  const openReports = useCallback((ids: string[], nextTopic: string | string[] = [], nextSource: string | string[] = [], expand = false, documentIds: string[] = []) => {
    const topics = topicIds(nextTopic);
    const sources = Array.isArray(nextSource) ? nextSource : nextSource ? [nextSource] : [];
    const candidates = reportingFacets(bundle, rows, { places, diseases, topics, sources, includeContext }).rows;
    const candidateIds = new Set(candidates.map(record => record.id));
    const broaden = ids.some(id => !candidateIds.has(id));
    const targetDocuments = reportDocuments(broaden ? rows : candidates, basis, topics, sources);
    if (broaden) { setPlaces([]); setDiseases([]); }
    const targetChronology = reportChronology(targetDocuments, !ids.length && !topics.length && !diseases.length && !kind.length && daily.data ? pendingDailyDocuments(dailySelection(daily.data, window, sources, broaden ? [] : places), new Set(bundle.records.map(row => row.id))) : [], id => atlasDocuments.get(id)!);
    const targets = highlightedReportIds(targetChronology, ids, documentIds);
    const index = targetChronology.findIndex(entry => targets.has(entry.id));
    setTopic(topics); setSource(sources); setTab("reports"); setReportView("reports"); setHover(null);
    setReportEvidence({ recordIds: ids, documentIds });
    setReportPage({ scope: JSON.stringify([basis, window, topics, sources, broaden ? [] : places, broaden ? [] : diseases, includeContext]), index: index < 0 ? 0 : Math.floor(index / reportsPerPage) });
    setReportJump({ documentId: index < 0 ? null : targetChronology[index].id, expand });
  }, [bundle, places, diseases, includeContext, rows, basis, reportDocuments, window, kind, daily.data, atlasDocuments]);
  const showReports = useCallback((ids: string[], expand?: boolean) => openReports(ids, [], [], expand), [openReports]);
  const showDailyReport = (id: string) => {
    const index = documents.findIndex(entry => entry.dailyVersions.some(document => document.id === id));
    if (index < 0) return;
    setTab("reports"); setReportView("reports"); setReportEvidence({ recordIds: [], documentIds: [id] });
    setReportPage({ scope: reportScope, index: Math.floor(index / reportsPerPage) });
    setReportJump({ documentId: documents[index].id, expand: true });
  };
  const showWatchReports = (item: import("@/lib/atlas-daily").DailyWatch) => {
    const support = dailyView!.documents.filter(document => item.document_ids.includes(document.id));
    openReports([], [], [], false, [...new Set(support.flatMap(document => [document.id, ...document.base_document_ids]))]);
  };
  const showAnalysisReports = (ids: string[], expand = true) => {
    const known = ids.filter(id => lookup.has(id));
    if (known.every(id => recordIds.has(id))) { showReports(known, expand); return; }
    const targetIds = new Set(known);
    const allDocuments = reportDocuments(windowRecords(min, max, basis), basis, [], []);
    const index = allDocuments.findIndex(records => records.some(record => targetIds.has(record.id)));
    setWindow([min, max]); setPreset(3); setTopic([]); setSource([]); setPlaces([]); setDiseases([]); setIncludeContext(false); setReportEvidence({ recordIds: known, documentIds: [] });
    setTab("reports"); setReportView("reports");
    setReportPage({ scope: JSON.stringify([basis, [min, max], [], [], [], [], false]), index: Math.max(0, Math.floor(index / reportsPerPage)) });
    setReportJump({ documentId: index < 0 ? null : allDocuments[index][0].document_id, expand });
  };
  const showSourceReports = useCallback((s: string) => openReports(filtered.filter(r => r.source === s).map(r => r.id), topic, s), [openReports, filtered, topic]);
  const showTopicReports = useCallback((id: string) => { chooseTopic(id); openReports(filtered.filter(r => r.track === id).map(r => r.id), id, source); }, [chooseTopic, openReports, filtered, source]);
  const showConnectionReports = useCallback((s: string, id: string) => openReports(filtered.filter(r => r.source === s && r.track === id).map(r => r.id), id, s), [openReports, filtered]);
  const showAssessment = useCallback((id: string) => {
    const index = assessments.findIndex(assessment => assessment.id === id);
    if (index < 0) return;
    setAssessmentKind("relationships"); setReportView("assessments"); setTab("reports");
    setEntryPages(current => ({ ...current, scope: entryScope, assessments: Math.floor(index / reportsPerPage) }));
    setReportJump({ documentId: null, headingId: `atlas-assessment-${id}` });
  }, [assessments, entryScope]);
  const showRisk = useCallback((id: string) => {
    panelStates.set("reports.risk", experiment?.data?.risk_profiles.find(profile => profile.record_id === id)?.id ?? "");
    setRiskRecord(id); setAssessmentKind("risk"); setReportView("assessments");
    setReportJump(undefined); setTab("reports");
    workspaceScroll.current?.scrollTo({ top: 0 });
  }, [panelStates, experiment]);
  function changeReportPage(index: number) {
    if (!Number.isInteger(index) || index < 0 || index >= pageCount) return;
    setReportPage({ scope: reportScope, index });
    setReportJump({ documentId: null });
  }
  function changeEntryPage(view: "links" | "assessments" | "sources", index: number) {
    const count = view === "links" ? linkPageCount : view === "sources" ? sourcePageCount : assessmentPageCount;
    if (!Number.isInteger(index) || index < 0 || index >= count) return;
    setEntryPages(current => ({ ...current, scope: entryScope, [view]: index }));
    setReportJump({ documentId: null, headingId: `atlas-${view}-heading` });
  }
  function viewEvidence() {
    openReports(calloutLink ? calloutLink.support.map(([id]) => String(id)) : calloutReports.map(r => r.id), calloutNode ? `place:${calloutNode.topics.join(",")}` : "");
  }
  return <AtlasPanelStateContext value={panelStates}><AtlasWorkspaceContext value={fullscreen}><div className="atlas-stage" style={fullscreen ? { height: pageHeight } : undefined}><div ref={page} className="atlas-page" data-ready={!arriving} data-fullscreen={fullscreen || undefined} role={fullscreen ? "dialog" : undefined} aria-modal={fullscreen || undefined} aria-label={fullscreen ? "ATLAS full screen" : undefined} onKeyDown={event => {
    if (!fullscreen || event.defaultPrevented) return;
    if (event.key === "Escape") { event.preventDefault(); changeFullscreen(false); }
    if (event.key === "Tab") {
      const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select, summary, [tabindex]')].filter(el => el.tabIndex >= 0 && el.getClientRects().length);
      const first = targets[0], last = targets.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <div className="atlas-overview-column">

    <header className="atlas-heading">
      <div><p className="atlas-eyebrow"><Activity size={14} aria-hidden /> Outbreak intelligence</p>
        <h1><Image className="atlas-title-logo" src="/atlas-logo.svg" alt="" width={132} height={132} loading="eager" /><AuroraText colors={["var(--primary)", "#639b91", "var(--foreground)"]} speed={0.45}>ATLAS</AuroraText></h1></div>
    {fullscreen && <button ref={exit} className="atlas-fullscreen-exit" onClick={() => changeFullscreen(false)}><Minimize2 size={17} aria-hidden />Exit full screen<span>Esc</span></button>}
      <p>Follow the reports.<br /><span>Explore the connections.</span></p>
    </header>
    <section ref={panel} className="atlas-observatory" aria-label="Surveillance globe">
      <div className="atlas-globe-space"><div className="atlas-globe-frame globe-frame" data-testid="atlas-globe" data-expand-hint={wide && !fullscreen && surfaceHover && !hover || undefined} onPointerMove={overSurface} onPointerLeave={event => { if (!(event.relatedTarget instanceof Node) || !entrance.current?.contains(event.relatedTarget)) setSurfaceHover(false); }} onClick={event => {
        if (!event.defaultPrevented && onGlobeSurface(event)) changeFullscreen(true);
      }}>
        <Globe fullscreen={fullscreen} playing={motion.playing} rotating={!fullscreen && !topic.length && !selectedLink} visible={motion.visible || arriving} onDragStart={() => setDragHint(null)}
          nodes={arriving ? undefined : globeNodes} links={arriving ? undefined : globeLinks} layoutLinks={arriving ? undefined : globeLayout}
          selected={selectedNode?.id} focus={focus} onSelect={choosePoint} onLink={chooseLink} onHover={setHover} annotation={calloutTarget} onAnnotationMove={moveCallout} />
        {!arriving && dragHint !== null && (dragHint === 0 || fullscreen) && <GlobeDragHint key={dragHint} visible={motion.visible} onComplete={() => setDragHint(null)} />}
      </div></div>
      {calloutTarget && (calloutNode || calloutLink) && <GlobeCallout key={calloutGroup?.id ?? `${calloutTarget.kind}:${calloutTarget.id}`} point={calloutPoint} targetKey={`${calloutTarget.kind}:${calloutTarget.id}`} pinned={!hover}>
        {!hover && <button aria-label="Clear globe selection" onClick={() => { clearSelection(); (fullscreen ? exit : entrance).current?.focus({ preventScroll: true }); }}><X size={14} /></button>}
        <div className="atlas-callout-heading"><span className="atlas-status" data-tone={calloutLink?.type === "hypothesis" ? "warning" : undefined}>
          {calloutLink ? calloutLink.type === "hypothesis" ? <TriangleAlert size={13} aria-hidden /> : calloutLink.directed ? <ArrowRight size={13} aria-hidden /> : <Network size={13} aria-hidden /> : <MapPin size={13} aria-hidden />}
          {calloutLink ? linkLabels[calloutLink.type] : "Reporting location"}
        </span></div>
        <strong className="atlas-callout-title">{calloutLink?.label ?? calloutNode?.label}</strong>
        <div className="atlas-callout-locations">
          {calloutLink ? <><LocationBadges codes={calloutEndpoints[0]} />{calloutLink.directed ? <ArrowRight size={15} aria-label="to" /> : <ArrowLeftRight size={15} aria-label="and" />}<LocationBadges codes={calloutEndpoints[1]} /><span className="sr-only">{calloutLink.from.label} {calloutLink.directed ? "to" : "and"} {calloutLink.to.label}</span></>
            : <LocationBadges codes={calloutNode!.countries} />}
        </div>
        <div className="atlas-callout-meta">
          <span><FileText size={14} aria-hidden />{calloutDocumentCount} report{calloutDocumentCount === 1 ? "" : "s"}</span>
          {calloutLatest && !(calloutGroup && calloutGroup.entries.length > 1 && !hover) && <span><CalendarDays size={14} aria-hidden />Latest report · <time dateTime={calloutLatest}>{formatDate(calloutLatest)}</time></span>}
        </div>
        {calloutGroup && calloutGroup.entries.length > 1 && (hover
          ? <span className="atlas-link-count">{calloutGroup.entries.length} links</span>
          : <LinkHistory group={calloutGroup} selected={calloutLink!.id} onChange={chooseLink} />)}
        <MetricFigures kind={calloutLink ? "geographic_link" : "topic"} ids={calloutLink ? [calloutLink.id] : calloutNode!.topics} recordIds={new Set(calloutRecords.map(r => r.id))} compact />
        {!hover && <a className="atlas-callout-action" href="#atlas-panel" onClick={e => { e.preventDefault(); viewEvidence(); }}>View evidence <ArrowRight size={14} aria-hidden /></a>}

      </GlobeCallout>}
      {wide && !fullscreen && !arriving && <button ref={entrance} className="atlas-fullscreen-entrance" aria-label="Click to enter full screen" data-visible={surfaceHover && !hover || undefined} onClick={() => changeFullscreen(true)}><Maximize2 size={17} aria-hidden />Enter full screen</button>}
      <AtlasNetworkOverview recordIds={new Set(filtered.map(record => record.id))} release={release} links={eligibleLinks} onReport={ids => openReports(ids)} />
      <div className="atlas-link-legend atlas-reveal" role="list" aria-label="Link types" data-playing={motion.playing}>
        {Object.entries(linkLabels).map(([type, label]) => <div key={type} role="listitem">
          <span className="atlas-legend-symbol" aria-hidden="true">
            <svg className="atlas-route" data-kind={type} viewBox="0 0 56 20">
              <path className="atlas-route-halo" d="M6 10H50" />
              <path className="atlas-route-line" d="M6 10H50" />
            </svg>
            {type === "movement" && <span className="atlas-legend-arrow"><svg className="atlas-route" data-kind={type} viewBox="0 0 56 20">
              <defs><linearGradient id={legendBeamId} gradientUnits="userSpaceOnUse" x1="29" y1="10" x2="6" y2="10"><BeamGradientStops start="#58ac8b" end="var(--atlas-travel-head)" projected /></linearGradient></defs>
              <g className="globe-beam-green"><BeamStroke path="M6 10H29" gradientId={legendBeamId} width={2} glow /></g>
            </svg></span>}
          </span>
          <span>{label}</span>
        </div>)}
      </div>
    </section>
    <div className="atlas-controls atlas-reveal">
      <div className="atlas-time-heading"><CalendarDays size={17} aria-hidden /><strong>Reporting window</strong>
        <div className="atlas-date-presets" role="group" aria-label="Reporting window presets" data-custom={preset === null} style={{ "--preset-index": preset ?? 0 } as CSSProperties}>
          {[3, 6, 12, 0].map((months, index) => <button key={months} aria-label={months === 0 ? "All dates" : months === 12 ? "1 year" : `${months} months`} aria-pressed={preset === index} onClick={() => {
            const from = months ? monthsBefore(window[1], months) : min;
            changeWindow(from < min ? min : from, months ? window[1] : max);
            setPreset(index);
          }}>{months === 0 ? "All" : months === 12 ? "1y" : `${months}m`}</button>)}
        </div>
      </div>
      <div className="atlas-ranges" style={{ "--range-start": `${startPercent}%`, "--range-end": `${endPercent}%` } as CSSProperties}>
        <div className="atlas-range-dates">
          <time dateTime={window[0]} aria-label={`From ${formatDate(window[0])}`}>{formatDate(window[0])}</time>
          <time dateTime={window[1]} aria-label={`To ${formatDate(window[1])}`}>{formatDate(window[1])}</time>
        </div>
        <div className="atlas-range-track" aria-hidden="true"><span /></div>
        <input type="range" aria-label="Window start" aria-valuetext={formatDate(window[0])} min={dayNumber(min)} max={dayNumber(max)} value={dayNumber(window[0])} onChange={e => changeWindow(dayDate(Math.min(Number(e.target.value), dayNumber(window[1]))), window[1])} />
        <input type="range" aria-label="Window end" aria-valuetext={formatDate(window[1])} min={dayNumber(min)} max={dayNumber(max)} value={dayNumber(window[1])} onChange={e => changeWindow(window[0], dayDate(Math.max(Number(e.target.value), dayNumber(window[0]))))} />

      </div>
      <section className="atlas-filter-panel" aria-label="Filters and selections">
        <div className="atlas-filters" data-faceted>
          <>
            <div data-active={places.length > 0}><AtlasSelect multiple searchable label="Reporting place" value={places} onChange={value => changeFacet("places", value)} summaryLabel={<span className="atlas-facet-label"><MapPin size={14} aria-hidden /><span>{places.length === 1 ? placeChoices.find(item => item.value === places[0])?.label : places.length ? `${places.length} places` : "All places"}</span></span>} items={[{ value: "", label: "All places" }, ...placeChoices]} /></div>
            <div data-active={diseases.length > 0}><AtlasSelect multiple searchable label="Reporting disease" value={diseases} onChange={value => changeFacet("diseases", value)} summaryLabel={<span className="atlas-facet-label"><svg data-icon="virus" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="6" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M19 5l-3 3m-8 8-3 3" /><circle cx="10" cy="10" r=".7" fill="currentColor" stroke="none" /><circle cx="14" cy="12" r=".7" fill="currentColor" stroke="none" /><circle cx="11" cy="15" r=".7" fill="currentColor" stroke="none" /></svg><span>{diseases.length === 1 ? facets.diseases.find(item => item.value === diseases[0])?.label : diseases.length ? `${diseases.length} diseases` : "All diseases"}</span></span>} items={[{ value: "", label: "All diseases" }, ...facets.diseases]} /></div>
          </>
          <div data-active={source.length > 0}><AtlasSelect multiple searchable label="Reporting source" value={source} onChange={changeSource} summaryLabel={<span className="atlas-facet-label"><Building2 size={14} aria-hidden /><span>{source.length === 1 ? sourceLabel(source[0]) : source.length ? `${source.length} sources` : "All sources"}</span></span>} items={[{ value: "", label: "All sources" }, ...sourceChoices]} /></div>
          <div data-active={kind.length > 0}><AtlasSelect multiple label="Link type" value={kind} onChange={changeKind} summaryLabel={<span className="atlas-facet-label"><GitBranch size={14} aria-hidden /><span>{kind.length === 1 ? linkLabels[kind[0]] : kind.length ? `${kind.length} link types` : "All link types"}</span></span>} items={[{ value: "", label: "All link types" }, ...Object.entries(linkLabels).map(([value, label]) => ({ value, label }))]} /></div>
          <div className="atlas-filter-actions">
            <details className="atlas-select atlas-rules" ref={rulesMenu} data-active={ruleCount > 0} onKeyDown={event => {
              if (event.key === "Escape") { event.preventDefault(); event.currentTarget.open = false; event.currentTarget.querySelector("summary")?.focus(); }
            }}>
              <summary aria-label={`Active rules: ${ruleCount}`}><span><SlidersHorizontal size={15} aria-hidden /><b>{ruleCount}</b></span></summary>
              <div className="atlas-select-options atlas-rules-options">
                {activeFilters.length > 0 && <div className="atlas-active-filters" aria-label="Active filters">
                  {activeFilters.map(filter => <button key={filter.key} onClick={() => clearRule(filter.clear)} aria-label={`Remove ${filter.key} filter`} title={filter.label}><span>{"summary" in filter ? filter.summary : filter.label}</span><X size={13} aria-hidden /></button>)}
                </div>}
                {(selectedLink || hasReportEvidence) && <div className="atlas-filter-selections" aria-label="Active selections">
                  {selectedLink && <button onClick={() => clearRule(clearSelection)} aria-label="Clear selected route"><ScanLine size={13} aria-hidden /><span>Selected route · {atlas.map_links.find(link => link.id === selectedLink)?.label}</span><X size={13} aria-hidden /></button>}
                  {hasReportEvidence && <button onClick={() => clearRule(clearReportEvidence)} aria-label="Clear evidence highlights"><FileText size={13} aria-hidden /><span>Highlighted evidence · {evidence.size} reports</span><X size={13} aria-hidden /></button>}
                </div>}
                {ruleCount === 0 && <p className="atlas-select-empty">No active rules</p>}
                <div className="atlas-filter-advanced">
                  <AtlasSelect multiple searchable label="Reporting topic" value={topic} onChange={id => chooseTopic(id, tab)} items={[{ value: "", label: "All topics" }, ...atlas.tracks.map(track => ({ value: track.id, label: track.label }))]} />
                  <label className="atlas-select-check"><input type="checkbox" checked={includeContext} onChange={event => { setIncludeContext(event.target.checked); setSelectedLink(""); setSelectedPoint(""); setHover(null); clearReportEvidence(); }} /><span>Include background locations</span></label>
                </div>
                {topic.length === 1 && tracks.get(topic[0])?.location_note && <p className="atlas-location-note"><ScanLine size={15} aria-hidden />{tracks.get(topic[0])?.location_note}</p>}
              </div>
            </details>
            <button className="atlas-filter-reset" title="Reset all" aria-label="Reset all" data-active={ruleCount > 0} disabled={!ruleCount} onClick={resetAll}><RotateCcw size={15} aria-hidden /></button>
          </div>
        </div>
      </section>
    </div>
    </div>
    <div className="atlas-detail-column">
    <section className="atlas-workspace atlas-reveal" aria-label="Report evidence" data-experiment="true" data-report-view={tab === "reports" ? reportView : undefined}>
      <div ref={toolbar} className="atlas-toolbar">
        <button className="atlas-toolbar-action atlas-toolbar-reset" title="Reset all filters and rules" aria-label="Reset all filters and rules" data-active={ruleCount > 0} disabled={!ruleCount} onClick={resetAll}><RotateCcw size={17} aria-hidden /></button>
      <div className="atlas-tabs" role="tablist" aria-label="Evidence views">{tabs.map(([id, label, Icon]) => <button key={id} id={`atlas-tab-${id}`} role="tab" aria-label={label} title={label} tabIndex={tab === id ? 0 : -1} onKeyDown={e => {
            const index = tabs.findIndex(t => t[0] === tab);
            const next = e.key === "ArrowRight" ? (index + 1) % tabs.length : e.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : -1;
            if (next >= 0) { e.preventDefault(); changeTab(tabs[next][0]); document.getElementById(`atlas-tab-${tabs[next][0]}`)?.focus(); }
          }} aria-selected={tab === id} aria-controls="atlas-panel" onClick={() => changeTab(id)}><Icon size={16} aria-hidden /><span>{label}</span>{id !== "trends" && id !== "one-health" && id !== "analysis" && <b>{id === "reports" ? documents.length : id === "links" ? links.length : new Set(filtered.map(r => r.source)).size}</b>}</button>)}</div>
        {process.env.NEXT_PUBLIC_SHOW_APPEARANCE !== "false" && <Settings inline />}
      </div>
      {tab === "reports" && <div className="atlas-report-tools atlas-panel-tools" data-coverage={showingSources || undefined} data-timeline={showingReports && window[1] === max && documents.length > 0 || undefined}>
          <div key={reportView} className="atlas-report-context">
          {showingAssessments ? <div className="atlas-assessment-switch" role="group" aria-label="Assessment category">
            <button aria-label="Report relationships" title="Report relationships" aria-pressed={assessmentKind === "relationships"} aria-controls="atlas-panel" onClick={() => setAssessmentKind("relationships")}><GitBranch size={15} aria-hidden /><span>Relationships</span></button>
            <button aria-label="Source risk assessments" title="Source risk assessments" aria-pressed={assessmentKind === "risk"} aria-controls="atlas-panel" onClick={() => setAssessmentKind("risk")}><ShieldCheck size={15} aria-hidden /><span>Risks</span></button>
          </div> : (showingSources || showingAssessments || window[1] === max && documents.length > 0) && <div className="atlas-timeline-next">
            <span className="atlas-timeline-next-label">
              <span><span>Captured</span><time dateTime={atlas.snapshot.captured_at}>{formatDate(atlas.snapshot.captured_at)}</time></span>
              <RefreshCw size={14} aria-hidden />
              <span title={`Planned update · ${atlas.snapshot.schedule_timezone}`}><span>Next update <span className="sr-only">(planned)</span></span><time dateTime={atlas.snapshot.next_update_date}>{formatDate(atlas.snapshot.next_update_date)}</time></span>
            </span>
          </div>}
          </div>
      <div className="atlas-report-switch" role="group" aria-label="Report content">
        {reportTabs.map(([id, label, Icon])=><button key={id} id={`atlas-report-view-${id}`} aria-label={label} title={label} aria-pressed={reportView===id} aria-controls="atlas-panel" onClick={()=>changeReportView(id)} onKeyDown={event=>{
          const index = reportTabs.findIndex(item => item[0] === id);
          const nextIndex = event.key === "ArrowLeft" ? (index + reportTabs.length - 1) % reportTabs.length : event.key === "ArrowRight" ? (index + 1) % reportTabs.length : event.key === "Home" ? 0 : event.key === "End" ? reportTabs.length - 1 : -1;
          const next = nextIndex < 0 ? null : reportTabs[nextIndex][0];
          if (next) { event.preventDefault(); changeReportView(next); document.getElementById(`atlas-report-view-${next}`)?.focus(); }
        }}><Icon size={15} aria-hidden /><span>{label}</span><b>{id==="reports"?documents.length:id==="sources"?new Set(filtered.map(r=>r.source)).size:assessments.length}</b></button>)}
      </div></div>}
      <div className="atlas-workspace-scroll" ref={workspaceScroll}>
      <div id="atlas-panel" role="tabpanel" aria-labelledby={`atlas-tab-${tab}`}>
        {showingReports && <div className="atlas-report-list">
          <div className="atlas-report-prelude">
          <h2 className="sr-only" id="atlas-report-heading" tabIndex={-1}>Report chronology</h2>
          <p className="sr-only" role="status">{documents.length ? `${pageIndex * reportsPerPage + 1}–${Math.min((pageIndex + 1) * reportsPerPage, documents.length)} of ${documents.length} reports` : "0 reports"}</p>

          {daily.error && <p className="atlas-daily-notice" role="status">{daily.error}</p>}
          {documents.length === 0 && <p className="atlas-empty">No reports in this selection. Widen the dates or clear the focus.</p>}
          {topic.length > 0 && <ObservationHistory topicIds={topicIds(topic)} recordIds={new Set(filtered.map(r => r.id))} onReport={showReports} />}
          </div>
          {pageDocuments.map(({ records, dailyVersions, weeklyVersions, id }) => !records.length && dailyView ? <DailyReport key={id} documents={dailyVersions} selection={dailyView} highlighted={evidence.has(id) || reportJump?.documentId === id} /> : <Report key={id} daily={dailyVersions} dailyView={dailyView} versions={weeklyVersions} records={records} basis={basis} highlighted={evidence.has(id) || reportJump?.documentId === id} recordIds={recordIds} onReport={openReports} relationships={reportRelationships} riskRecords={riskRecords} onAssessment={showAssessment} onRisk={showRisk} />)}
        </div>}
        {tab === "analysis" && <AtlasAnalysis footerTarget={footerTarget} experiment={experiment} rows={filtered} links={eligibleLinks} seriesId={analysisSeries} onSeries={setAnalysisSeries} onReport={showAnalysisReports} onLink={chooseLink} /> }
        {tab === "one-health" && <AtlasOneHealth mergedTimeline initialReport={healthReport} footerTarget={footerTarget} rows={filtered} onReport={showReports} />}
        {tab === "trends" && <AtlasTrends rows={filtered} window={window} onReport={showReports} onBrowseReports={() => { changeTab("reports"); changeReportView("reports"); }} daily={dailyView} dailyDocuments={dailyDocuments} dailyState={daily} dailyExcluded={dailyExcluded} onDailyReport={showDailyReport} onWatchReports={showWatchReports} onPeriod={month => {
          const from = month + "-01", until = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
          changeWindow(from < window[0] ? window[0] : from, until > window[1] ? window[1] : until);
          setTab("reports"); setReportView("reports"); setReportJump({ documentId: null });
        }} />}
        {tab === "links" && <>
          <h2 className="sr-only" id="atlas-links-heading" tabIndex={-1}>Geographic links</h2>
          {chains.length > 0 && <div className="atlas-geographic-journeys"><AtlasChains chains={chains} onReport={showReports} /></div>}
          {links.length === 0 && <p className="atlas-empty">No supported geographic links in this selection.</p>}
          {links.slice(linkPageIndex * reportsPerPage, (linkPageIndex + 1) * reportsPerPage).map((link, index) => <GeographicEntry key={linkGroups[linkPageIndex * reportsPerPage + index].id} link={link} group={linkGroups[linkPageIndex * reportsPerPage + index]} selected={link.id === selectedLink} recordIds={recordIds} onLocate={chooseLink} onReport={openReports} />)}
        </>}
        {showingAssessments && assessmentKind === "risk" && <AtlasRiskAssessments experiment={experiment} initialRecord={riskRecord} rows={filtered} onReport={showReports} onOneHealth={id => { panelStates.set("health.report", id); panelStates.set("health.mode", "network"); panelStates.set("health.selection", ""); panelStates.set("health.filters", []); setHealthReport(id); changeTab("one-health"); }} />}
        {showingRelationships && <>
          <h2 className="sr-only" id="atlas-assessments-heading" tabIndex={-1}>Source assessments</h2>
          {assessments.length === 0 && <p className="atlas-empty">No assessments supported by this reporting window.</p>}
          {assessments.slice(assessmentPageIndex * reportsPerPage, (assessmentPageIndex + 1) * reportsPerPage).map(a => <AssessmentEntry key={a.id} selected={reportJump?.headingId === `atlas-assessment-${a.id}`} assessment={a} recordIds={recordIds} onLocate={chooseTopic} onReport={openReports} />)}
        </>}
        {showingSources && <>
          <h2 className="sr-only" id="atlas-sources-heading" tabIndex={-1}>Source coverage</h2>
          <div className="atlas-coverage-filters" role="group" aria-label="Source coverage filters">
            <div className="atlas-coverage-filter"><h3>Sources</h3><AtlasSelect multiple searchable label="Coverage sources" value={source} onChange={changeSource} items={[{ value: "", label: "All sources" }, ...sourceChoices]} /></div>
            <div className="atlas-coverage-filter"><h3>Topics</h3><AtlasSelect multiple searchable label="Coverage topics" value={topic} onChange={ids => chooseTopic(ids, "reports")} items={[{ value: "", label: "All topics" }, ...atlas.tracks.map(track => ({ value: track.id, label: track.label }))]} /></div>
          </div>
          <SourceNetwork key={`${entryScope}:${sourcePageIndex}`} topics={sourcePageTopics} rows={filtered} onSource={showSourceReports} onTopic={showTopicReports} onConnection={showConnectionReports} />
        </>}
      </div>

    </div>
    <footer ref={setFooterTarget} className="atlas-workspace-footer">
      <AtlasScope buttonLabel="About ATLAS" label="About ATLAS" title="ATLAS">
      <div className="atlas-literature atlas-methods">
        <p className="atlas-about-name">Agentic Tracking and Longitudinal Analysis for Surveillance</p>
        <div className="atlas-about-ui" aria-label="ATLAS UI release">
          <span className="atlas-status"><GitBranch size={13} aria-hidden />ATLAS UI v{atlasUI.version}</span>
          <span className="atlas-status" data-tone="warning"><FlaskConical size={13} aria-hidden />{atlasUI.status}</span>
        </div>
        <p>ATLAS UI visualizes exports produced by ATLAS, bringing source documents, extracted findings and their supporting quotations into one view.</p>
        <a className="atlas-about-repo" href="https://github.com/EvoLandEco/ATLAS" target="_blank" rel="noopener noreferrer"><GitBranch size={16} aria-hidden /><span>EvoLandEco/ATLAS</span><ExternalLink size={13} aria-hidden /><span className="sr-only"> on GitHub</span></a>
        <section className="atlas-about-section" aria-labelledby="atlas-about-technology">
          <h3 id="atlas-about-technology"><FlaskConical size={16} aria-hidden />Built with</h3>
          <dl className="atlas-about-credits">
            <div><dt>AI engine</dt><dd>GPT-6 Astra</dd></div>
            <div><dt>Interface backbone</dt><dd>MagicUI</dd></div>
            <div><dt>Dataset storage &amp; delivery</dt><dd>Cloudflare R2</dd></div>
          </dl>
        </section>
        <section className="atlas-about-section" aria-labelledby="atlas-about-snapshot">
          <h3 id="atlas-about-snapshot"><CalendarDays size={16} aria-hidden />Research snapshot</h3>
          <p>{formatDate(atlas.snapshot.publication_from)} – {formatDate(atlas.snapshot.publication_until)} · {atlas.snapshot.selected_document_count} reports from a corpus of {atlas.snapshot.corpus_document_count}.</p>
          <p>{metrics.coverage.measure_count} source-checked measurements across {metrics.coverage.records_with_measures} report entries; {metrics.coverage.pending_candidate_count} candidates await review. Editorial acceptance is pending. Figures retain their source scope and observation dates; comparability remains under review.</p>
          <p>Extracted findings and proposed relationships are provided for research review, not as an accepted event registry or a measure of transmission risk.</p>
        </section>
        <section className="atlas-about-section" aria-labelledby="atlas-about-reading">
          <h3 id="atlas-about-reading"><FileText size={16} aria-hidden />Reading the evidence</h3>
          <dl className="atlas-about-methods">
            <div><dt>Dates &amp; scope</dt><dd>Dates refer to publication or capture, not outbreak onset. Relationships appear when every supporting report falls inside the selected window; later assessments use their own supporting documents.</dd></div>
            <div><dt>Locations &amp; links</dt><dd>Globe points use reviewed locations and retain the available precision. Routes group endpoint pairs by their latest supporting publication. Travel, shared events and hypotheses require explicit source support; shared bulletin coverage appears in the source network.</dd></div>
            <div><dt>Source fidelity</dt><dd>Conflicting accounts remain visible, and hypotheses stay distinct from established routes. Place names identify reporting locations without taking a position on sovereignty or boundaries. Source titles and quotations retain their original wording.</dd></div>
          </dl>
        </section>
        <div className="atlas-about-downloads">
          <a className="atlas-download" href={`${downloadRoot}/atlas-site.json`} download><Download size={16} aria-hidden />Download dataset</a>
          <a className="atlas-download" href={`${downloadRoot}/metrics.json`} download><Download size={16} aria-hidden />Download measurements</a>
        </div>
      </div>
      </AtlasScope>
      {showingReports && release.source_supplement && <AtlasUndatedSources key={release.source_supplement.sha256} release={release} />}
    <>
      {showingReports && pageCount > 1 && <ReportPagination position="bottom" index={pageIndex} items={pageItems} onChange={changeReportPage} />}
      {tab === "links" && linkPageCount > 1 && <ReportPagination entity="Geographic link" position="bottom" index={linkPageIndex} items={linkPageItems} onChange={index => changeEntryPage("links", index)} />}
      {showingRelationships && assessmentPageCount > 1 && <ReportPagination entity="Assessment" position="bottom" index={assessmentPageIndex} items={assessmentPageItems} onChange={index => changeEntryPage("assessments", index)} />}
      {showingSources && sourcePageCount > 1 && <ReportPagination entity="Topic" position="bottom" index={sourcePageIndex} items={sourcePageItems} onChange={index => changeEntryPage("sources", index)} />}
    </>
    </footer>
    </section>

    </div>
  </div></div></AtlasWorkspaceContext></AtlasPanelStateContext>;
}

function LinkHistory({ group, selected, onChange }: { group: ReturnType<typeof groupGeographicLinks>[number]; selected: string; onChange: (id: string) => void }) {
  if (group.entries.length < 2) return null;
  const index = group.entries.findIndex(e => e.link.id === selected);
  return <div className="atlas-link-history">
    <div><span>{index + 1} / {group.entries.length} links</span><time dateTime={group.entries[index].date}>{formatDate(group.entries[index].date)}</time></div>
    <input type="range" aria-label="Link history" min={0} max={group.entries.length - 1} value={index}
      aria-valuetext={`${formatDate(group.entries[index].date)}, link ${index + 1} of ${group.entries.length}`}
      onChange={event => onChange(group.entries[Number(event.target.value)].link.id)} />
  </div>;
}


const AssessmentEntry = memo(function AssessmentEntry({ assessment: a, selected, recordIds, onLocate, onReport }: {
  assessment: AtlasAssessment; selected: boolean; recordIds: Set<string>; onLocate: (id: string) => void; onReport: (ids: string[]) => void;
}) {
  const { tracks } = useAtlas();
  return <article className="atlas-connection" data-assessment-id={a.id} data-selected={selected}>
            <header id={`atlas-assessment-${a.id}`} className="atlas-entry-heading" tabIndex={-1}><div className="atlas-item-meta"><span className="atlas-status"><Info size={14} aria-hidden />{a.status}</span><button onClick={() => onLocate(a.track)}><ScanLine size={16} />Locate</button></div>
            <div className="atlas-entry-title"><h3>{tracks.get(a.track)?.label}</h3><button className="atlas-collapse-entry" onClick={collapseEntry} aria-label={`Collapse details for ${tracks.get(a.track)?.label}`}><ChevronsUp size={15} aria-hidden /><span>Collapse</span></button></div></header><p className="atlas-assessment-dates">{a.from} → {a.to}</p><p>{a.basis}</p><MetricFigures kind="assessment" ids={[a.id]} recordIds={recordIds} />
            {a.updates?.map((u, i) => supported(u.support, recordIds) && <div className="atlas-assessment-update" key={i}><strong>Later assessment</strong><p>{u.text}</p><MetricFigures kind="assessment_update" ids={[`${a.id}:${i}`]} recordIds={recordIds} /><AtlasDisclosure unmountOnClose summary={<EvidenceSummary kind="source" />}>{() => <Evidence support={u.support} onReport={onReport} />}</AtlasDisclosure></div>)}
            <AtlasDisclosure unmountOnClose summary={<EvidenceSummary kind="scope" />}>{() => <><p>{a.limit}</p><Evidence support={a.support} onReport={onReport} /></>}</AtlasDisclosure>
          </article>;
});

const GeographicEntry = memo(function GeographicEntry({ link, group, selected, recordIds, onLocate, onReport }: {
  link: AtlasLink; group: ReturnType<typeof groupGeographicLinks>[number]; selected: boolean; recordIds: Set<string>;
  onLocate: (id: string) => void; onReport: (ids: string[]) => void;
}) {
  return <article data-link-id={link.id} className="atlas-connection" data-kind={link.type} data-selected={selected}>
            <header className="atlas-entry-heading" tabIndex={-1}><div className="atlas-item-meta"><span className="atlas-status" data-tone={link.type === "hypothesis" ? "warning" : undefined}>{link.type === "hypothesis" ? <TriangleAlert size={14} aria-hidden /> : link.directed ? <ArrowRight size={14} aria-hidden /> : <Network size={14} aria-hidden />}{linkLabels[link.type]}</span><button onClick={() => onLocate(link.id)} aria-label={`Locate ${link.label}`}><ScanLine size={16} />Locate</button></div>
            <div className="atlas-entry-title"><h3 className="atlas-link-subject">{link.label}</h3><button className="atlas-collapse-entry" onClick={collapseEntry} aria-label={`Collapse details for ${link.label}`}><ChevronsUp size={15} aria-hidden /><span>Collapse</span></button></div></header><GeographicRoute link={link} /><LinkHistory group={group} selected={link.id} onChange={onLocate} />
            <p>{link.basis}</p><MetricFigures kind="geographic_link" ids={[link.id]} recordIds={recordIds} /><AtlasDisclosure unmountOnClose open={selected} summary={<EvidenceSummary kind="location" />}>{() => <><p>{link.limit}</p><p className="atlas-precision">{link.from.precision}<br />{link.to.precision}</p><Evidence support={link.support} onReport={onReport} /></>}</AtlasDisclosure>
          </article>;
});

function GeographicRoute({ link }: { link: AtlasLink }) {
  const { countriesForLink } = useAtlas();
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  const codes = countriesForLink(link);
  return <div className="atlas-geographic-route" data-directed={link.directed} aria-label={`${link.from.label} ${link.directed ? "to" : "and"} ${link.to.label}`}>
    {[link.from, link.to].map((endpoint, i) => <div className="atlas-geographic-route-place" key={i}>
      <span className="atlas-geographic-route-pin">{codes[i].map(code => <LocationSymbol key={code} code={code} />)}</span>
      <strong>{codes[i].map(code => names.of(code)).join(" · ")}</strong>
      {endpoint.label !== codes[i].map(code => names.of(code)).join(" · ") && <span>{endpoint.label}</span>}
    </div>)}
    <div className="atlas-geographic-route-path" aria-hidden>
      <svg viewBox="0 0 120 4" preserveAspectRatio="none"><path className="atlas-geographic-route-line" d="M0 2H120" /></svg>
      {link.directed && <ChevronRight className="atlas-geographic-route-arrow" size={18} />}
    </div>
  </div>;
}


const Report = memo(function Report({ records, versions, basis, daily, dailyView, highlighted, recordIds, onReport, relationships, riskRecords, onAssessment, onRisk }: { versions?: AtlasRecord[][]; daily?: DailyDocument[]; dailyView?: DailySelection; relationships: Map<string, AtlasAssessment[]>; riskRecords: Set<string>; onAssessment: (id: string) => void; onRisk: (id: string) => void; records: AtlasRecord[]; basis: DateBasis; highlighted: boolean; recordIds: Set<string>; onReport: (ids: string[]) => void }) {
  const { sourceName, atlasDocuments, reportOrganizations, reportComparisons, assertions, englishTitle } = useAtlas();
  const [open, setOpen] = useAtlasPanelState(`report.${records[0].document_id}.open`, false);
  const [loaded, setLoaded] = useState(open);
  const first = records[0];
  const document = atlasDocuments.get(first.document_id)!;
  const organization = reportOrganizations[first.source];
  const comparisons = reportComparisons(recordIds, records.map(r => r.id));
  const comparedMeasures = new Set(comparisons.flatMap(c => c.participant_ids).map(id => assertions.get(id)!.measure_id).filter((id): id is string => id !== null));
  return <details open={open} className="atlas-report" id={`atlas-report-${first.document_id}`} data-evidence={highlighted} onToggle={event => { if (event.target !== event.currentTarget) return; setOpen(event.currentTarget.open); if (event.currentTarget.open) setLoaded(true); }}>
    <summary onClick={event => { if (event.currentTarget.parentElement?.hasAttribute("open")) keepHeadingVisible(event.currentTarget); }}><span className="atlas-timeline-node institution-logo atlas-source-logo">{organization.logo ? <Image src={`/logos/atlas/${organization.logo}`} alt={organization.name} width={32} height={32} unoptimized /> : <Building2 size={20} role="img" aria-label={organization.name} />}</span><span className="atlas-report-date">{formatDate(document[basis])}<small>{sourceName(first.source)}</small></span>
      <span className="atlas-report-summary">{highlighted && <span className="sr-only">Relevant report. </span>}<strong>{englishTitle(document)}</strong>
        {!!daily?.length && <DailyProcessing document={daily.find(doc => doc.processing_status === "weekly_review_pending") ?? daily[0]} />}
        {comparisons.filter((c, i) => comparisons.findIndex(other => other.kind === c.kind) === i).map(c => <ComparisonBadge key={c.kind} comparison={c} />)}</span><span className="atlas-expand" aria-hidden><ChevronDown size={17} /></span></summary>
    {loaded && daily && dailyView && daily.map(doc => <div className="atlas-report-body" key={doc.id}><DailyVersion document={doc} selection={dailyView} /></div>)}
    {loaded && (versions ?? [records]).map(group => <ReportBody key={group[0].document_id} records={group} basis={basis} recordIds={recordIds} onReport={onReport} relationships={relationships} riskRecords={riskRecords} onAssessment={onAssessment} onRisk={onRisk} comparedMeasures={comparedMeasures} />)}
  </details>;
});

function ReportBody({ records, basis, recordIds, onReport, relationships, riskRecords, onAssessment, onRisk, comparedMeasures }: { records: AtlasRecord[]; basis: DateBasis; recordIds: Set<string>; onReport: (ids: string[]) => void; relationships: Map<string, AtlasAssessment[]>; riskRecords: Set<string>; onAssessment: (id: string) => void; onRisk: (id: string) => void; comparedMeasures: Set<string> }) {
  const { atlasDocuments, tracks } = useAtlas();
  const document = atlasDocuments.get(records[0].document_id)!;
  const { data, error, retry } = useAtlasDetails(records.map(record => ({ collection: "map.records", id: record.id })));
  if (!data) return <AtlasDetailStatus error={error} retry={retry} />;
  return <ReportCountryFlags value={true}><div className="atlas-report-body"><div className="atlas-item-meta atlas-report-meta"><span><CalendarDays size={14} aria-hidden />{basis === "publication" ? `Captured ${formatDate(document.capture)}` : `Published ${formatDate(document.publication)}`}</span><a href={document.url} target="_blank" rel="noopener noreferrer">Read source <ExternalLink size={14} aria-hidden /></a></div>
      <OriginalTitle document={document} />
      <SourceComparisons recordIds={recordIds} reportIds={records.map(r => r.id)} onReport={onReport} />
      {records.map(summary => data.get("map.records", summary.id)).map(record => <div key={record.id}><h3><CountryText>{tracks.get(record.track)?.label}</CountryText></h3>
        {(relationships.has(record.id) || riskRecords.has(record.id)) && <div className="atlas-report-assessment-links">
          {relationships.has(record.id) && <details><EvidenceSummary kind="relationships" count={relationships.get(record.id)!.length} />
            <ol>{relationships.get(record.id)!.map(assessment => <li key={assessment.id}><button data-assessment-id={assessment.id} onClick={() => onAssessment(assessment.id)}><span><strong>{assessment.status}</strong>{(assessment.from || assessment.to) && <small>{[assessment.from, assessment.to].filter(Boolean).join(" → ")}</small>}</span><ArrowRight size={14} aria-hidden /></button></li>)}</ol>
          </details>}
          {riskRecords.has(record.id) && <button onClick={() => onRisk(record.id)}><ShieldCheck size={14} aria-hidden />Source risk assessment<ArrowRight size={14} aria-hidden /></button>}
        </div>}
        <ReportSourceAssessments recordIds={recordIds} recordId={record.id} />
        <MetricFigures kind="record" ids={[record.id]} recordIds={recordIds} exclude={comparedMeasures} />{record.claims.map(claim => <div className="atlas-claim" key={claim.claim_index}><p><CountryText>{claim.text}</CountryText></p>{claim.quotes.length > 0 && <AtlasDisclosure summary={<EvidenceSummary kind="quotation" />}>{() => claim.quotes.map((q, i) => <SourceQuotation key={i} quote={q} recordId={record.id} claimIndex={claim.claim_index} quoteIndex={i} />)}</AtlasDisclosure>}</div>)}</div>)}
    </div></ReportCountryFlags>;
}

const SourceNetwork = memo(function SourceNetwork({ rows, topics, onSource, onTopic, onConnection }: {
  rows: AtlasRecord[]; topics: AtlasTrack[]; onSource: (source: string) => void; onTopic: (id: string) => void; onConnection: (source: string, topic: string) => void;
}) {
  const { sourceName, reportOrganizations, countriesForReports } = useAtlas();
  const { sources, height, sourceY, topicY, sourceCounts, topicData, edges } = useMemo(() => {
    const sources = [...new Set(rows.map(r => r.source))].sort();
    const height = Math.max(topics.length, sources.length) * 46 + 8;
    const sourceY = sources.map((_, i) => 26 + i * 46);
    const topicY = topics.map((_, i) => 26 + i * 46);
    const count = (records: AtlasRecord[]) => new Set(records.map(r => r.document_id)).size;
    const sourceCounts = sources.map(source => count(rows.filter(r => r.source === source)));
    const topicData = topics.map(topic => {
      const records = rows.filter(r => r.track === topic.id);
      return { count: count(records), countries: countriesForReports(records) };
    });
    const edges = sources.flatMap((source, si) => topics.flatMap((topic, ti) => {
      const records = rows.filter(r => r.source === source && r.track === topic.id);
      return records.length ? [{ source, topic: topic.id, label: topic.label, count: count(records), y1: sourceY[si], y2: topicY[ti] }] : [];
    }));
    return { sources, height, sourceY, topicY, sourceCounts, topicData, edges };
  }, [rows, topics, countriesForReports]);
  function interactions(activate: () => void) {
    return { onClick: activate, onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); }
    } };
  }
  return <div className="atlas-network-scroll">{!rows.length ? <p className="atlas-empty">No source coverage in this selection.</p> : <svg className="atlas-source-network" viewBox={`0 0 680 ${height}`} role="group" aria-label="Sources connected to reporting topics">
    <g>
      {edges.map(edge => {
        const path = `M188 ${edge.y1} C228 ${edge.y1},228 ${edge.y2},268 ${edge.y2}`;
        const label = `${sourceName(edge.source)} · ${edge.label} · ${edge.count} source document${edge.count === 1 ? "" : "s"}`;
        return <g className="atlas-coverage-edge" data-source={edge.source} data-topic={edge.topic} key={`${edge.source}:${edge.topic}`} role="button" tabIndex={0} aria-label={label} {...interactions(() => onConnection(edge.source, edge.topic))}>
          <title>{label}</title><path className="atlas-coverage-base" d={path} /><path className="atlas-coverage-hit" d={path} />
        </g>;
      })}
      {sources.map((source, i) => {
        const organization = reportOrganizations[source];
        return <g className="atlas-coverage-node atlas-coverage-source" data-source={source} key={source} transform={`translate(0 ${sourceY[i]})`} role="button" tabIndex={0} aria-label={`Reports from ${source}`} {...interactions(() => onSource(source))}>
          <title>{`${organization.name} · ${sourceCounts[i]} source documents in the reporting selection`}</title>
          <rect className="atlas-coverage-surface" x="4" y="-21" width="184" height="42" rx="10" /><circle className="atlas-coverage-port" cx="188" r="3" />
          <foreignObject x="10" y="-20" width="170" height="40"><div className="atlas-coverage-source-label"><span className="institution-logo">{organization.logo ? <Image src={`/logos/atlas/${organization.logo}`} alt={organization.name} width={28} height={28} unoptimized /> : <Building2 size={20} role="img" aria-label={organization.name} />}</span><span>{sourceName(source)}</span><b>{sourceCounts[i]}</b></div></foreignObject>
        </g>;
      })}
      {topics.map((topic, i) => <g className="atlas-coverage-node atlas-coverage-topic" data-topic={topic.id} key={topic.id} transform={`translate(268 ${topicY[i]})`} role="button" tabIndex={0} aria-label={topic.label} {...interactions(() => onTopic(topic.id))}>
        <title>{`${topic.label} · ${topicData[i].count} source documents`}</title>
        <rect className="atlas-coverage-surface" y="-21" width="404" height="42" rx="10" /><circle className="atlas-coverage-port" r="3" />
        <foreignObject x="10" y="-20" width="384" height="40"><div className="atlas-coverage-topic-label"><strong>{topic.label}</strong><div><LocationBadges codes={topicData[i].countries} /><span>{topicData[i].count} report{topicData[i].count === 1 ? "" : "s"}</span></div></div></foreignObject>
      </g>)}
    </g>
  </svg>}</div>;
});


function GlobeCallout({ point, targetKey, pinned, children }: { point: MotionValue<GlobeAnchor>; targetKey: string; pinned: boolean; children: ReactNode }) {
  const card = useRef<HTMLDivElement>(null);
  const connector = useRef<SVGSVGElement>(null);
  const bounds = useRef<{ x: number; y: number; size: number; left: number; top: number; right: number; bottom: number } | null>(null);
  const side = useRef("");
  const measure = useRef(() => {});
  const draw = useCallback(() => {
    const projected = point.get(), box = bounds.current;
    const anchor = projected?.target === targetKey ? projected : null;
    if (!card.current || !connector.current) return;
    const visible = Boolean(anchor && box);
    card.current.style.visibility = connector.current.style.visibility = visible ? "visible" : "hidden";
    if (!anchor || !box) return;
    if (!side.current) {
      side.current = anchor.x >= 500 ? "left" : "right";
      card.current.dataset.side = side.current;
      measure.current();
      return;
    }
    const x = box.x + anchor.x / 1000 * box.size, y = box.y + anchor.y / 1000 * box.size;
    const centerX = (box.left + box.right) / 2, centerY = (box.top + box.bottom) / 2;
    const inside = x > box.left && x < box.right && y > box.top && y < box.bottom;
    const edges = [
      { x: box.left, y: centerY, horizontal: true, facing: x <= box.left },
      { x: box.right, y: centerY, horizontal: true, facing: x >= box.right },
      { x: centerX, y: box.top, horizontal: false, facing: y <= box.top },
      { x: centerX, y: box.bottom, horizontal: false, facing: y >= box.bottom },
    ].filter(edge => inside || edge.facing);
    const end = edges.sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    const path = end.horizontal
      ? `M${x},${y} H${(x + end.x) / 2} V${end.y} H${end.x}`
      : `M${x},${y} V${(y + end.y) / 2} H${end.x} V${end.y}`;
    connector.current.querySelector("path")?.setAttribute("d", path);
    const dot = connector.current.querySelector("circle");
    dot?.setAttribute("cx", String(x)); dot?.setAttribute("cy", String(y));
  }, [point, targetKey]);
  useMotionValueEvent(point, "change", draw);
  useLayoutEffect(() => {
    const element = card.current, svg = connector.current;
    const parent = element?.closest(".atlas-observatory");
    const globe = parent?.querySelector(".atlas-globe-frame");
    if (!element || !svg || !parent || !globe) return;
    measure.current = () => {
      const origin = parent.getBoundingClientRect(), frame = globe.getBoundingClientRect(), rect = element.getBoundingClientRect();
      bounds.current = { x: frame.left - origin.left, y: frame.top - origin.top, size: frame.width,
        left: rect.left - origin.left, top: rect.top - origin.top, right: rect.right - origin.left, bottom: rect.bottom - origin.top };
      draw();
    };
    const observer = new ResizeObserver(() => measure.current());
    observer.observe(element); observer.observe(parent); observer.observe(globe);
    measure.current();
    return () => observer.disconnect();
  }, [draw]);
  return <div className="atlas-callout">
    <svg className="atlas-callout-connector" ref={connector} aria-hidden="true"><path /><circle r="3" /></svg>
    <div className="atlas-callout-card" ref={card} data-pinned={pinned} role={pinned ? "region" : "tooltip"} aria-label={pinned ? "Selected map item" : undefined}>{children}</div>
  </div>;
}
