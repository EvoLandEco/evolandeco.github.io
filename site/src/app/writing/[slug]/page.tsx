import { Button } from "@/components/ui/button";
import { LegacyArticle } from "@/components/legacy-article";
import { ArrowLeft } from "lucide-react";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import data from "@/content-data/legacy.json";
const categoryIcons: Record<string, string> = {
  Development: "code",
  Networks: "network-wired",
  "Machine learning": "brain",
  Evolution: "dna",
};
export function generateStaticParams() {
  return data.articles.map((a) => ({ slug: a.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title: data.articles.find((a) => a.slug === slug)?.title,
    description: data.articles.find((a) => a.slug === slug)?.summary,
    alternates: { canonical: `/writing/${slug}` },
  };
}
export default async function Writing({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params,
    a = data.articles.find((a) => a.slug === slug);
  if (!a) notFound();
  const content = fs.readFileSync(
    path.join(process.cwd(), "content/writing", `${a.slug}.html`),
    "utf8",
  ).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return (
    <article className="surface blog-reader">
      <Button asChild className="gap-2 rounded-full" variant="ghost"><a href="/blog">
        <ArrowLeft size={16} aria-hidden /> All notes
      </a></Button>
      <header className="blog-reader-head">
        <span className="blog-category">
          <span aria-hidden="true" className="blog-category-icon" style={{ maskImage: `url(/icons/note-categories/${categoryIcons[a.category]}.svg)` }} />
          {a.category}
        </span>
        <h1>{a.title}</h1>
        <p>{a.summary}</p>
      </header>
      <LegacyArticle slug={slug} title={a.title} html={content} />
    </article>
  );
}
