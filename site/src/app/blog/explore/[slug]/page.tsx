import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";
import { ArrowLeft, Expand } from "lucide-react";
import data from "@/content-data/legacy.json";
export function generateStaticParams() { return data.tools.map(({ slug }) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = data.tools.find(tool => tool.slug === slug);
  return { title: tool?.title, description: tool?.summary, alternates: { canonical: `/blog/explore/${slug}` } };
}
export default async function Exploration({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = data.tools.find(tool => tool.slug === slug);
  if (!tool) notFound();
  return <section className="surface blog-reader">
    <Button asChild className="gap-2 rounded-xl" variant="ghost"><a href="/blog#explorations"><ArrowLeft size={16} aria-hidden /> All explorations</a></Button>
    <header className="blog-reader-head"><span className="blog-category">Interactive exploration</span><h1>{tool.title}</h1><p>{tool.summary}</p></header>
    <div className="exploration-toolbar"><Button asChild className="gap-2 rounded-xl" variant="outline"><a href={tool.href} target="_blank" rel="noreferrer">Open full screen <Expand size={16} aria-hidden /></a></Button></div>
    <iframe className="exploration-frame" src={tool.href} title={tool.title} allowFullScreen />
  </section>;
}
