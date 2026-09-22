import Image from "next/image";
import { useId } from "react";
import { ArrowUpRight, Mail } from "lucide-react";
import data from "@/content-data/portfolio.json";

export function SectionHeading({ label, title, description }: { label: string; title: string; description?: string }) {
  return <header className="portfolio-heading">
    <div className="section-rule"><span>{label}</span></div>
    <h2>{title}</h2>
    {description && <p>{description}</p>}
  </header>;
}

const institutions: Record<string, { file: string; url: string; className?: string }> = {
  "Wageningen University & Research": { file: "wur-symbol.svg", url: "https://www.wur.nl/en" },
  "University of Groningen": { file: "rug-symbol.svg", url: "https://www.rug.nl/" },
  "Beijing Forestry University": { file: "bfu.png", url: "https://www.bjfu.edu.cn/", className: "institution-logo-bfu" },
  "Nanjing Normal University": { file: "njnu-color.png", url: "https://www.njnu.edu.cn/", className: "institution-logo-njnu" },
};
export function InstitutionLogo({ name }: { name: string }) {
  const institution = institutions[name];
  return <a className={`institution-logo ${institution.className || ""}`} href={institution.url} aria-label={`${name} website`}>
    <span className="institution-symbol"><Image src={`/logos/${institution.file}`} alt={name} width={100} height={100} unoptimized /></span>
  </a>;
}

export function NetworkBackdrop({ className = "" }: { className?: string }) {
  const id = useId();
  const nodes = [[40,70],[130,125],[220,55],[310,145],[390,80],[485,125],[575,50],[675,155],[760,65],[875,130],[950,40],[110,260],[260,230],[440,265],[630,245],[825,270]];
  const edges = [[0,1],[1,2],[1,11],[2,3],[3,4],[3,12],[4,5],[5,6],[5,13],[6,7],[7,8],[7,14],[8,9],[9,10],[9,15],[11,12],[12,13],[13,14],[14,15]];
  return <svg className={`network-backdrop ${className}`} aria-hidden="true" viewBox="0 0 1000 340" preserveAspectRatio="xMidYMin slice">
    <defs><pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.3" /></pattern></defs>
    <rect width="1000" height="340" fill={`url(#${id})`} />
    <g className="network-edges">{edges.map(([a,b],i) => <path key={i} d={`M${nodes[a]} L${nodes[b]}`} />)}</g>
    {nodes.map(([cx,cy],i) => <circle key={i} className="network-node" cx={cx} cy={cy} r={i % 3 === 0 ? 3 : 2} style={{ animationDelay: `${i * -0.6}s` }} />)}
  </svg>;
}

export function ContactSection() {
  return <section className="contact-section" id="contact" aria-labelledby="contact-title">
    <NetworkBackdrop />
    <span className="contact-label">Contact</span>
    <div className="contact-copy">
      <h2 id="contact-title">Get in touch</h2>
      <p>Working on an interesting question in biology, networks or AI? Let’s connect.</p>
      <a className="contact-email" href={`mailto:${data.profile.email}`}><Mail size={18} aria-hidden /><span>{data.profile.email}</span><ArrowUpRight size={18} aria-hidden /></a>
    </div>
  </section>;
}
