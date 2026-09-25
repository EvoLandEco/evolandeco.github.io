import { notFound } from "next/navigation";
import { LoadingImage as Image } from "@/components/loading-image";
import Link from "next/link";
import { MDXContent } from "@content-collections/mdx/react";
import { allResearch } from "content-collections";
import data from "@/content-data/portfolio.json";
import { Paper } from "@/components/papers";
import { Programmes } from "@/components/programmes";
import { ScrollProgress } from "@/components/magicui/scroll-progress";
export function generateStaticParams() {
  return data.projects.map((p) => ({ slug: p.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = data.projects.find((p) => p.id === slug);
  return {
    title: p?.title,
    description: p?.summary,
    alternates: { canonical: `/research/${slug}` },
  };
}
export default async function Project({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    p = data.projects.find((p) => p.id === slug),
    article = allResearch.find((a) => a.projectId === slug);
  if (!p || !article) notFound();
  return (
    <>
      <ScrollProgress className="scroll-progress" />
      <article className="surface">
        <Link className="text-link" href="/research">
          ← Research
        </Link>
        <header className="page-head" style={{ marginTop: 24 }}>
          <p className="eyebrow">{p.status}</p>
          <h1>{p.title}</h1>
          <p>{p.subtitle}</p>
        </header>
        <Image
          className="detail-art"
          src={`/art/${p.id}-refined.webp`}
          alt="Conceptual research illustration"
          width={1536}
          height={1024}
        />
        <div className="article-copy">
          <MDXContent code={article.mdx} />
        </div>
        <h2 style={{ marginTop: 32 }}>Contribution</h2>
        <p className="intro-copy">{p.contribution}</p>
        <div className="actions">
          {data.software
            .filter((s) => p.softwareIds.includes(s.id))
            .map((s) => (
              <a key={s.id} className="button" href={s.url}>
                {s.name} · {s.linkKind} ↗
              </a>
            ))}
        </div>
      </article>
      {p.publicationIds.length > 0 && (
        <section className="surface">
          <h2>Related publications</h2>
          {data.publications
            .filter((a) => p.publicationIds.includes(a.id))
            .map((a) => (
              <Paper paper={a} key={a.id} />
            ))}
        </section>
      )}
      {p.id === "one-health" && (
        <section className="surface">
          <Programmes />
        </section>
      )}
    </>
  );
}
