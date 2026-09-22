import data from "@/content-data/portfolio.json";
import { BrainCircuit, Network, ShieldCheck, Workflow } from "lucide-react";
import { Timeline, TimelineEntry } from "./timeline";

const icons = { nextdai: BrainCircuit, eupahw: Network, "sss-mod": ShieldCheck, imbit: Workflow };

export function Programmes() {
  return (
    <Timeline className="career-timeline programme-timeline">
      {data.programmes.map((p) => {
        const Icon = icons[p.id as keyof typeof icons];
        const [name, ...description] = p.name.split(": ");
        return <article key={p.id} data-programme-id={p.id}>
          <TimelineEntry date={String(p.year)} title={name} location={description.join(": ")}
            icon={<Icon size={21} strokeWidth={1.5} aria-hidden />}>
            <span className="programme-status" data-status={p.status}>{p.status}</span>
            <p className="programme-context">{p.context}</p>
            <p>{p.contribution}</p>
          </TimelineEntry>
        </article>;
      })}
    </Timeline>
  );
}
