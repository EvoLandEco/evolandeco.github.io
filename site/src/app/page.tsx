import Image from "next/image";
import { AcademicGlobe, ProfileSocialLinks } from "@/components/visuals";
import { Mic, Award, BookOpen, Users } from "lucide-react";
import { Timeline, TimelineEntry } from "@/components/timeline";
import { InstitutionLogo, SectionHeading } from "@/components/portfolio-sections";
import data from "@/content-data/portfolio.json";
export const metadata = {
  title: "Home",
  description:
    "Biography, experience, education and contact details for Tianjian Qin.",
  alternates: { canonical: "/" },
};
export default function Home() {
  return (
    <>
      <section className="surface hero">
        <div className="hero-copy">
          <p className="hero-name"><span className="hero-name-text">Tianjian Qin</span><span className="hero-degree">PhD</span></p>
          <p className="hero-identity">Computational biology & AI</p>
          <h1>
            <span>Life is interconnected.</span>
            <span>I build tools to understand how.</span>
          </h1>
          <ProfileSocialLinks />
        </div>
        <AcademicGlobe />
      </section>
      <section className="surface">
        <SectionHeading label="Experience" title="Research experience" />
        <Timeline className="career-timeline">
          {data.experience.map((e) => (
            <TimelineEntry
              key={e.id}
              date={`${e.start}–${e.end || "present"}`}
              title={e.institution}
              location={e.title}
              icon={<InstitutionLogo name={e.institution} />}
            >
              <p>{e.description}</p>
            </TimelineEntry>
          ))}
        </Timeline>
      </section>
      <section className="surface" id="education">
        <SectionHeading label="Academic path" title="Education" />
        <Timeline className="career-timeline">
          {data.education.map((e) => (
            <TimelineEntry
              key={e.id}
              date={`${e.start}–${e.end}`}
              title={e.institution}
              location={`${e.degree} · ${e.city}, ${e.country}`}
              icon={<InstitutionLogo name={e.institution} />}
            >
              {e.description && <p>{e.description}</p>}
              {e.thesisUrl && (
                <div>
                  <a className="timeline-link" href={e.thesisUrl}>
                    <BookOpen size={13} aria-hidden />
                    Thesis
                  </a>
                </div>
              )}
            </TimelineEntry>
          ))}
        </Timeline>
      </section>
      <section className="surface">
        <SectionHeading label="Exchange" title="Talks & workshops" />
        <Timeline className="career-timeline">
          {data.talks.map((t) => (
            <TimelineEntry
              key={t.id}
              date={t.date}
              title={t.title}
              location={`${t.event} · ${t.location}`}
              icon={t.kind === "Workshop" ? <InstitutionLogo name="Wageningen University & Research" /> : <span className="institution-logo"><span className="institution-symbol"><Image src="/logos/modah-favicon.png" alt="ModAH" width={100} height={100} unoptimized /></span></span>}
            >
              {t.description && <p>{t.description}</p>}
              <div>
                {t.url ? <a className="timeline-link" href={t.url}>
                  <Mic size={13} aria-hidden />
                  {t.kind}
                </a> : <span className="timeline-link"><Users size={13} aria-hidden />{t.kind}</span>}
              </div>
            </TimelineEntry>
          ))}
        </Timeline>
      </section>
      <section className="surface">
        <SectionHeading label="Milestones" title="Recognition" />
        <Timeline className="career-timeline">
          {data.awards.map((a) => (
            <TimelineEntry
              key={a.id}
              date={String(a.year)}
              title={a.title}
              location={a.institution}
              icon={a.institution === "Beijing Forestry University" ? <InstitutionLogo name={a.institution} /> : <span className="institution-logo institution-logo-elsevier"><span className="institution-symbol"><Image src="/logos/publishers/elsevier.svg" alt="Elsevier" width={100} height={100} unoptimized /></span></span>}
            >
              {a.url && (
                <div>
                  <a className="timeline-link" href={a.url}>
                    <Award size={13} aria-hidden />
                    Award
                  </a>
                </div>
              )}
            </TimelineEntry>
          ))}
        </Timeline>
      </section>
    </>
  );
}
