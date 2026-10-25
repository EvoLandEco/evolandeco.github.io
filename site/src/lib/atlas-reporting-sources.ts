import type { AtlasData } from "./atlas-contract";
import type { DailyData } from "./atlas-daily";

type Channel = Pick<AtlasData["channels"][number], "id" | "acquisition_source" | "snapshot_source">;
type Coverage = Pick<DailyData["source_coverage"][number], "source_id" | "source_name" | "documents">;

export function createReportingSources(channels: Channel[], scientificSources: string[], coverage: Coverage[], sourceName: (id: string) => string) {
  const acquired = new Map(channels.map(channel => [channel.acquisition_source, channel]));
  const snapshots = new Map(channels.map(channel => [channel.snapshot_source, channel]));
  const choices = new Map(scientificSources.map(id => [id, sourceName(id)]));
  for (const row of coverage) if (row.documents > 0) {
    const value = acquired.get(row.source_id)?.snapshot_source ?? row.source_id;
    if (!choices.has(value)) choices.set(value, row.source_name);
  }
  return {
    choices: [...choices].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label)),
    dailySources: (selected: string[]) => [...new Set(selected.map(id => snapshots.get(id)?.acquisition_source ?? id))],
  };
}
