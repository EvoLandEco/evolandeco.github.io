import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, ArrowRight, FlaskConical, NotebookPen } from "lucide-react";
import { MagicCard } from "@/components/magicui/magic-card";
import { SectionHeading } from "@/components/portfolio-sections";
import data from "@/content-data/legacy.json";

export const metadata = {
  title: "Blog",
  description: "Interactive explorations and technical notes on evolution, networks and research software.",
  alternates: { canonical: "/blog" },
};

export default function Blog() {
  return <>
    <header className="blog-intro">
      <h1>Research notebook</h1>
      <p>Ideas, experiments and the code behind them.</p>
      <div className="blog-jump-links">
        <a href="#explorations"><FlaskConical size={16} aria-hidden />Explorations <span>{data.tools.length}</span></a>
        <a href="#notes"><NotebookPen size={16} aria-hidden />Technical notes <span>{data.articles.length}</span></a>
      </div>
    </header>
    <section className="surface" id="explorations">
      <SectionHeading label="Explore" title="Interactive explorations" />
      <div className="blog-explorations">
        {data.tools.map(tool => <MagicCard key={tool.slug} className="blog-experiment" gradientFrom="#729bd3" gradientTo="#7cbba5" gradientOpacity={0.08}>
          <Link href={`/blog/explore/${tool.slug}`}>
            <div className="blog-cover"><Image src={tool.image} alt="" width={640} height={360} /><span><ArrowUpRight size={19} aria-hidden /></span></div>
            <div className="blog-experiment-copy"><h3>{tool.title}</h3><p>{tool.summary}</p></div>
          </Link>
        </MagicCard>)}
      </div>
    </section>
    <section className="surface" id="notes">
      <SectionHeading label="Writing" title="Technical notes" />
      <div className="blog-notes">
        {data.articles.map(article => <Link className="blog-note" key={article.slug} href={`/writing/${article.slug}`}>
          <Image src={article.image} alt="" width={180} height={140} />
          <div><span className="blog-category">{article.category}</span><h3>{article.title}</h3><p>{article.summary}</p></div>
          <ArrowRight size={20} aria-hidden />
        </Link>)}
      </div>
    </section>
  </>;
}
