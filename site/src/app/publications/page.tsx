import Image from "next/image";
import { LoadingImage } from "@/components/loading-image";
import { ArrowUpRight, BookOpen, GraduationCap } from "lucide-react";
import data from "@/content-data/portfolio.json";
import { selectedPublications } from "@/lib/selected-publications";
import { Paper } from "@/components/papers";
export const metadata = {
  title: "Selected publications & thesis",
  description: "Tianjian Qin’s doctoral thesis and first-author papers on evolution, inference and biological networks.",
  alternates: { canonical: "/publications" },
};
export default function Publications() {
  const phd = data.education.find((item) => item.id === "phd")!;
  return (
    <>
      <section className="surface">
          <article className="thesis-layout">
            <a className="thesis-book" href={phd.thesisUrl!} aria-label="Read Diversification Models and Neural Inference, full thesis PDF">
              <LoadingImage src="/art/thesis-cover.webp" alt="Front cover of Diversification Models and Neural Inference by Tianjian Qin" width={1145} height={1600} sizes="(max-width: 639px) 200px, 230px" priority />
            </a>
            <div className="thesis-copy">
              <span className="thesis-label"><GraduationCap size={18} aria-hidden /> Doctoral thesis · {phd.end}</span>
              <h2>Diversification Models and Neural Inference</h2>
              <p className="thesis-institution"><Image src="/logos/rug-symbol.svg" alt="" width={14} height={21} unoptimized />{phd.institution}</p>
              <p>Exploring evolutionary diversification through stochastic models, phylogenies and neural inference.</p>
              <a className="thesis-read" href={phd.thesisUrl!}><BookOpen size={17} aria-hidden /> Read the thesis <ArrowUpRight size={16} aria-hidden /><span className="thesis-format">PDF</span></a>
            </div>
          </article>
      </section>
      <section className="surface publication-selection">
        <header className="portfolio-heading publication-heading">
          <div className="section-rule"><span>Papers</span></div>
          <h1>Selected publications</h1>
        </header>
        {["preprint", "peer-reviewed"].map((status) => (
          <section key={status} className="publication-group">
            <h2>{status === "preprint" ? "Preprints" : "Peer-reviewed articles"}</h2>
            <div className="publication-list">
            {selectedPublications.filter((p) => p.status === status).sort((a, b) => b.year - a.year).map((p) => <Paper key={p.id} paper={p} featured />)}
            </div>
          </section>
        ))}
        <p className="caption" style={{ marginTop: 32 }}>* Equal contribution. † Joint senior authors.</p>
      </section>
    </>
  );
}
