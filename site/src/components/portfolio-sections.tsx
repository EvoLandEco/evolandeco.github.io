import Image from "next/image";
import { NetworkBackdrop } from "./network-backdrop";
export { NetworkBackdrop } from "./network-backdrop";
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
