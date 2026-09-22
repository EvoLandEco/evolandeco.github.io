import { Button } from "@/components/ui/button";
import { LegacyArticle } from "@/components/legacy-article";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import fs from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import data from "@/content-data/legacy.json";
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
  );
  return (
    <article className="surface blog-reader">
      <Button asChild className="gap-2 rounded-xl" variant="ghost"><a href="/blog#notes">
        <ArrowLeft size={16} aria-hidden /> All notes
      </a></Button>
      <header className="blog-reader-head">
        <span className="blog-category">{a.category}</span>
        <h1>{a.title}</h1>
        <p>{a.summary}</p>
      </header>
      <Image className="blog-reader-cover" src={a.image} alt="" width={960} height={420} />
      <LegacyArticle slug={slug} title={a.title} html={content} />
    </article>
  );
}
