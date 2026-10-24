import type { AtlasRecord } from "./atlas";
import type { DailyDocument } from "./atlas-daily";

const dailyDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit" });

export function attentionHasPendingReview(documents: Pick<DailyDocument, "publication" | "processing_status">[], from: string, until: string) {
  return documents.some(document => {
    if (document.processing_status !== "weekly_review_pending" || !document.publication) return false;
    const date = document.publication.includes("T") ? dailyDate.format(new Date(document.publication)) : document.publication;
    return from <= date && date <= until;
  });
}

export function attentionSelection(rows: Pick<AtlasRecord, "id" | "publication">[], window: [string, string], days: 7 | 30) {
  const start = new Date(`${window[1]}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const from = [window[0], start.toISOString().slice(0, 10)].sort()[1];
  const until = window[1];
  const ids = new Set(rows.filter(row => {
    const date = row.publication.slice(0, 10);
    return from <= date && date <= until;
  }).map(row => row.id));
  return { from, until, ids };
}
