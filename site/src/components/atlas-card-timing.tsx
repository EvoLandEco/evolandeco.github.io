import { CalendarDays } from "lucide-react";
import type { CSSProperties } from "react";
import { useAtlas } from "./atlas-context";
import { dayNumber, formatDate } from "@/lib/atlas";

export function CardTiming({ support, label }: { support: (string | number)[][]; label: string }) {
  const { lookup, atlasDocuments } = useAtlas();
  const documents = [...new Set(support.map(([id]) => lookup.get(String(id))!.document_id))].map(id => atlasDocuments.get(id)!);
  const dates = [...new Set(documents.map(document => document.publication.slice(0, 10)))].sort();
  if (!dates.length) return null;
  const first = dates[0], last = dates.at(-1)!;
  const span = dayNumber(last) - dayNumber(first);
  return <section className="atlas-card-timing" data-single={dates.length === 1 || undefined} role="group" aria-label={label}>
    <div className="atlas-card-timing-heading"><span><CalendarDays size={13} aria-hidden />{label}</span>{dates.length > 1 && <small>{span} {span === 1 ? "day" : "days"} between reports</small>}</div>
    <div className="atlas-card-timing-dates"><time dateTime={first}>{formatDate(first)}</time>{dates.length > 1 && <time dateTime={last}>{formatDate(last)}</time>}</div>
    {dates.length > 1 && <ol className="atlas-card-timing-track" aria-label="Publication dates">{dates.map(date => {
      const count = documents.filter(document => document.publication.slice(0, 10) === date).length;
      const description = `${formatDate(date)} · ${count} ${count === 1 ? "report" : "reports"}`;
      return <li key={date} style={{ "--date-position": `${(dayNumber(date) - dayNumber(first)) / span * 100}%` } as CSSProperties} title={description}><time className="sr-only" dateTime={date}>{description}</time></li>;
    })}</ol>}
  </section>;
}
