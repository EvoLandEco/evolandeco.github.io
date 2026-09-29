import type { AtlasObservationTime } from "./atlas-contract";

const day = 86_400_000;
function dateStart(value: string) {
  return Date.parse(`${value.length === 4 ? value + '-01-01' : value.length === 7 ? value + '-01' : value}T00:00:00Z`);
}
function dateEnd(value: string) {
  if (value.length === 10) return dateStart(value);
  const start = new Date(dateStart(value));
  if (value.length === 4) start.setUTCFullYear(start.getUTCFullYear() + 1);
  else start.setUTCMonth(start.getUTCMonth() + 1);
  return start.getTime() - day;
}

// Calendar bounds locate the reported precision on an axis; they do not add observation dates.
export function observationTimeBounds(time: AtlasObservationTime): [number, number] | null {
  if (!["point", "closed_interval"].includes(time.extent) || !time.start.value || time.precision === "unknown" || ["unknown", "reporting_cutoff"].includes(time.kind)) return null;
  return [dateStart(time.start.value), dateEnd(time.end.value ?? time.start.value)];
}
export function observationDate(value: string) {
  if (value.length === 4) return value;
  return new Intl.DateTimeFormat("en-GB", {timeZone:"UTC",year:"numeric",month:"short",...(value.length === 10 ? {day:"numeric" as const} : {})}).format(dateStart(value));
}
export function observationTimeLabel(time: AtlasObservationTime) {
  const start = time.start.value, end = time.end.value;
  const dates = time.extent === "open_interval" ? start ? `${observationDate(start)} · end unknown` : end ? `Start unknown · end ${observationDate(end)}` : "Date unknown" : start ? end && end !== start ? `${observationDate(start)} – ${observationDate(end)}` : observationDate(start) : end ? `Start unknown · end ${observationDate(end)}` : "Date unknown";
  return [dates, time.certainty === "approximately" ? "approximate" : time.certainty === "uncertain" ? "uncertain" : time.certainty === "unknown" ? "certainty unknown" : null].filter(Boolean).join(" · ");
}
