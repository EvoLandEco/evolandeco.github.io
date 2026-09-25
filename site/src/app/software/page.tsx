import { AuroraText } from "@/components/magicui/aurora-text";
import { NetworkBackdrop, SectionHeading } from "@/components/portfolio-sections";
import {
  Brain,
  Network,
  Code2,
  Server,
  ChartNoAxesCombined,
} from "lucide-react";
import data from "@/content-data/portfolio.json";
import { ToolkitCloud, SoftwareTerminal } from "@/components/visuals";
export const metadata = {
  title: "Software",
  description:
    "Research tools, open source contributions and technical writing.",
  alternates: { canonical: "/software" },
};
const skillHighlights: Record<string, string> = {
  ai: "Neural networks · PyTorch",
  modelling: "Stochastic models · Simulation-based inference",
  programming: "Python · R · C/C++ · SQL",
  computing: "Linux · HPC · Docker",
  web: "React · D3.js · Three.js",
};
export default function Software() {
  return (
    <>
      <section className="surface toolkit-feature">
        <h1 className="sr-only">Software</h1>
        <div className="toolkit-intro"><h2 className="visual-intro"><AuroraText colors={["var(--primary)", "var(--toolkit-sage)", "var(--primary)"]} speed={0.45}>The tools behind the research.</AuroraText></h2></div>
        <div className="toolkit-layout">
          <div className="toolkit-copy">
          <div className="toolkit-list" data-testid="toolkit-list">
            {data.skills.map((s, index) => {
              const Icon = [Brain, Network, Code2, Server, ChartNoAxesCombined][
                index
              ];
              return (
                <div className="toolkit-skill" key={s.id}>
                  <span className="toolkit-skill-icon"><Icon size={20} aria-hidden /></span>
                  <div>
                    <h3>{s.label}</h3>
                    <p>{skillHighlights[s.id]}</p>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          <div className="toolkit-sphere">
            <NetworkBackdrop />
            <span className="toolkit-orbit" aria-hidden="true" />
            <ToolkitCloud />
          </div>
        </div>
      </section>
      <section className="surface" id="tools">
        <SectionHeading label="Open source" title="Software & contributions" />
        <SoftwareTerminal />
      </section>
    </>
  );
}
