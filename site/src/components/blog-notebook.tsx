"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, LayoutGrid, Code2, Network, Brain, GitBranch } from "lucide-react";
import { AuroraText } from "@/components/magicui/aurora-text";
import data from "@/content-data/legacy.json";

const categories = [
  { name: "Development", id: "development", icon: Code2 },
  { name: "Networks", id: "networks", icon: Network },
  { name: "Machine learning", id: "machine-learning", icon: Brain },
  { name: "Evolution", id: "evolution", icon: GitBranch },
];

export function BlogNotebook() {
  const [selected, setSelected] = useState("All");
  return <>
    <header className="blog-intro">
      <h1>Research <AuroraText colors={["var(--primary)", "var(--notebook-sage)", "var(--primary)"]} speed={0.45}>notebook</AuroraText></h1>
      <div className="blog-filters" role="group" aria-label="Filter notes by category">
        <button type="button" aria-label={`All notes ${data.articles.length}`} title="All notes" aria-pressed={selected === "All"} onClick={() => setSelected("All")}><LayoutGrid size={16} aria-hidden /><span className="blog-filter-label">All notes</span><span className="blog-filter-count">{data.articles.length}</span></button>
        {categories.map(({ name, id, icon: Icon }) => <button type="button" key={id} aria-label={`${name} ${data.articles.filter(article => article.category === name).length}`} title={name} aria-pressed={selected === name} onClick={() => setSelected(name)}>
          <Icon size={16} aria-hidden /><span className="blog-filter-label">{name}</span><span className="blog-filter-count">{data.articles.filter(article => article.category === name).length}</span>
        </button>)}
      </div>
    </header>
    {categories.filter(({ name }) => selected === "All" || selected === name).map(({ name, id, icon: Icon }) => <section className="surface blog-category-section" id={id} key={id} aria-labelledby={`${id}-heading`}>
      <h2 className="blog-category-heading" id={`${id}-heading`}><Icon size={20} aria-hidden />{name}</h2>
      <div className="blog-notes">
        {data.articles.filter(article => article.category === name).map(article => <Link className="blog-note" key={article.slug} href={`/writing/${article.slug}`}>
          <Image src={article.image} alt="" width={180} height={140} />
          <div><h3>{article.title}</h3><p>{article.summary}</p></div>
          <ArrowRight size={20} aria-hidden />
        </Link>)}
      </div>
    </section>)}
  </>;
}
