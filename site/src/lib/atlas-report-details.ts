import type { DailySelection } from "./atlas-daily";
import type { AtlasMapSnapshot, AtlasMeasure, AtlasComparison } from "./atlas-contract";
import type { Comparison } from "./atlas-comparisons";

type RecordDetail = AtlasMapSnapshot["records"][number];
export function groupReportClaims(records: RecordDetail[]) {
  const groups = new Map<string, { record: RecordDetail; claim: RecordDetail["claims"][number] }[]>();
  for (const record of records) for (const claim of record.claims) {
    const key = claim.quotes.length ? JSON.stringify([claim.text, claim.quotes, record.conflict]) : JSON.stringify([record.id, claim.claim_index]);
    const group = groups.get(key) ?? [];
    group.push({ record, claim }); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => new Set(group.map(ref => ref.record.document_id)).size === group.length ? [group] : group.map(ref => [ref]));
}

export function internalVersionComparison(c: Comparison, records: Set<string>, assertions: ReadonlyMap<string, { record_id: string }>) {
  return c.kind === "republication" && c.status === "documented" && !c.lineage.length && c.participant_ids.every(id => records.has(assertions.get(id)!.record_id));
}

export function groupVersionReviews(comparisons: AtlasComparison[]) {
  const groups = new Map<string, AtlasComparison[]>();
  for (const c of comparisons) {
    const key = JSON.stringify([c.kind, c.status, c.reason, c.scope_review, c.independence, c.review_state, c.reviewed_by, c.reviewed_at, c.lineage]);
    const group = groups.get(key) ?? [];
    group.push(c); groups.set(key, group);
  }
  return [...groups.values()];
}

const measureReferences = new Set(["annotation_key", "measure_id", "context_id", "track_id", "source_reference", "context_references", "evidence_references", "capture", "source_url"]);
export function groupReportMeasures(measures: AtlasMeasure[]) {
  const groups = new Map<string, AtlasMeasure[]>();
  for (const measure of measures) {
    const separate = measure.conflict_set || measure.superseded || measure.supersedes.length || measure.proposal_candidates.length;
    const key = separate ? measure.measure_id : JSON.stringify(Object.entries(measure).filter(([field]) => !measureReferences.has(field)).sort(([a], [b]) => a.localeCompare(b)));
    const group = groups.get(key) ?? [];
    group.push(measure); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => new Set(group.map(m => m.source_reference.document_id)).size === group.length ? [group] : group.map(m => [m]));
}

export function groupDailyFindings(findings: DailySelection["findings"], evidence: DailySelection["evidence"]) {
  const sources = new Map(evidence.map(row => [row.id, row]));
  const groups = new Map<string, typeof findings>();
  for (const finding of findings) {
    const quotes = finding.evidence_ids.map(id => {
      const row = sources.get(id)!;
      return [row.quote, row.language_tag, row.translation?.text, row.translation?.review_status, row.translation?.origin];
    });
    const key = JSON.stringify([finding.kind, finding.text, finding.status, finding.statement_kind, finding.attribution, finding.observation_period, finding.places, finding.review_state, quotes]);
    const group = groups.get(key) ?? [];
    group.push(finding); groups.set(key, group);
  }
  return [...groups.values()].flatMap(group => new Set(group.map(f => f.document_id)).size === group.length ? [group] : group.map(f => [f]));
}
