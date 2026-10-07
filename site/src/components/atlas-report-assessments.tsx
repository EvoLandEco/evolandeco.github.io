import { formatDate } from "@/lib/atlas";
import { useAtlas } from "./atlas-context";
import { AtlasDisclosure } from "./atlas-disclosure";
import { EvidenceSummary } from "./atlas-evidence-summary";
import { AssertionEvidence } from "./atlas-comparisons";

export function ReportSourceAssessments({ recordIds, recordId }: { recordIds: Set<string>; recordId: string }) {
  const { reportAssessments } = useAtlas();
  const assessments = reportAssessments(recordIds, [recordId]);
  if (!assessments.length) return null;
  return <AtlasDisclosure summary={<EvidenceSummary kind="scope" />}>{() => assessments.map(assessment => <div className="atlas-claim" key={assessment.id} data-assessment-kind={assessment.kind} data-status={assessment.status}>
      <p><strong>{assessment.label}</strong></p>
      <p>{assessment.scope}</p>
      {assessment.authority.value && <div className="atlas-item-meta">{assessment.authority.value}</div>}
      <AtlasDisclosure summary={<EvidenceSummary kind="source" />}>{() => <>
        <p>{assessment.reason}</p>
        <AssertionEvidence ids={assessment.evidence_ids} />
        <small>Source review · {assessment.reviewed_by} · {formatDate(assessment.reviewed_at)} · Editorial review pending</small>
      </>}</AtlasDisclosure>
    </div>)}</AtlasDisclosure>;
}
