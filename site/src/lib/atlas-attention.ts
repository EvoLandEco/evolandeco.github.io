import type { AtlasRecord } from "./atlas";

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
