import Image from "next/image";
import data from "@/content-data/portfolio.json";
import { ArrowUpRight } from "lucide-react";
import { CopyCitation } from "./publication-controls";
const publishers: Record<string, { file: string; name: string }> = {
  "Systematic Biology": { file: "oup-favicon.png", name: "Oxford University Press" },
  "Journal of Theoretical Biology": { file: "elsevier.svg", name: "Elsevier" },
  "Plant Biology": { file: "wiley.png", name: "Wiley" },
  "Weed Research": { file: "wiley.png", name: "Wiley" },
  "Marine and Freshwater Research": { file: "csiro.png", name: "CSIRO Publishing" },
  "bioRxiv": { file: "biorxiv.ico", name: "bioRxiv" },
};
export function Paper({
  paper: p,
  compact = false,
  featured = false,
}: {
  paper: (typeof data.publications)[number];
  compact?: boolean;
  featured?: boolean;
}) {
  const publisher = publishers[p.venue];
  return (
    <article
      className={`paper${featured ? " paper-featured" : ""}`}
      data-publication-id={p.id}
      data-publication-status={p.status}
    >
      <div className="paper-content">
      {featured && <div className="paper-heading">
        <span className="publisher-emblem" data-publisher={publisher.name} title={publisher.name}>
          <Image src={`/logos/publishers/${publisher.file}`} alt={publisher.name} width={32} height={32} unoptimized />
        </span>
        <span className="paper-venue">{p.venue}{p.volume && <span className="paper-volume"> · {p.volume}{p.issue && `(${p.issue})`}{p.pages && `, ${p.pages}`}</span>}</span>
        <time className="paper-year">{p.year}</time>
      </div>}
      <h3>
        <a href={p.url}>
          {p.title}{" "}
          <span className="text-link" aria-hidden>
            ↗
          </span>
        </a>
      </h3>
      {!compact && (
        <p className="authors">
          {p.authors.map((a, i) => (
            <span
              key={i}
              data-equal-contribution={a.equalContribution || undefined}
            >
              {i > 0 ? ", " : ""}
              {a.isOwner ? <strong>{a.displayName}</strong> : a.displayName}
              {a.equalContribution ? <sup>*</sup> : null}
              {a.jointSenior ? <sup>†</sup> : null}
            </span>
          ))}
        </p>
      )}
      {!featured && <div className="paper-meta">
        {!featured && <><span>{p.venue}</span><span>·</span><span>{p.year}</span></>}
        {!compact && p.volume && (
          <span>
            {p.volume}
            {p.issue && `(${p.issue})`}
            {p.pages && `, ${p.pages}`}
          </span>
        )}
        {p.status === "preprint" && <span className="preprint">Preprint</span>}
      </div>}
      {!compact && (
        <div className="paper-actions">
          <a className="paper-action" href={p.url} aria-label={`Read ${p.title}`}>
            Read paper <ArrowUpRight size={14} aria-hidden />
          </a>
          <CopyCitation id={p.id} />
        </div>
      )}
      </div>
    </article>
  );
}
