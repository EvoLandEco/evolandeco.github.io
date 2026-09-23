"use client";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Globe2, TerminalSquare, Users, Package, Github, Linkedin, Fingerprint, GitBranch, Network, MapPin, BrainCircuit, ChartNoAxesCombined, Code2, ArrowUpRight } from "lucide-react";
import softwareCards from "@/content-data/software-presentation.json";
import portfolio from "@/content-data/portfolio.json";
import { ShinyButton } from "./magicui/shiny-button";
import { Globe } from "./magicui/globe";
import { IconCloud } from "./magicui/icon-cloud";
import { AnimatedBeam } from "./magicui/animated-beam";
import { AuroraText } from "./magicui/aurora-text";
import { LineShadowText } from "./magicui/line-shadow-text";
import { GlyphMatrix } from "./magicui/glyph-matrix";
import { Terminal, TypingAnimation } from "./magicui/terminal";
import { usePanelMotion } from "./motion-policy";
import data from "@/content-data/ui-content.json";
const images = data.iconCloudItems.map((i) => i.assetPath);
const phoneGlobeQuery = "(hover: none) and (max-width: 639px)";
function subscribePhoneGlobe(notify: () => void) {
  const media = matchMedia(phoneGlobeQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
export function AcademicGlobe() {
  const phone = useSyncExternalStore(subscribePhoneGlobe, () => matchMedia(phoneGlobeQuery).matches, () => false);
  const GlobeControl = phone ? "button" : "a";
  const [calloutActive, setCalloutActive] = useState(false);
  const [touchOpen, setTouchOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const m = usePanelMotion(panel, true);
  useEffect(() => {
    if (!touchOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) setTouchOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTouchOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [touchOpen]);
  return (
    <div
      ref={panel}
      className="globe-panel"
      data-testid="signature-globe"
      data-motion-state={m.playing ? "running" : "paused"}
    >
      <div className="globe-interaction" data-touch-open={touchOpen}
        onPointerEnter={(event) => { if (event.pointerType !== "touch") setCalloutActive(true); }} onPointerLeave={() => setCalloutActive(false)}
        onFocusCapture={() => setCalloutActive(true)} onBlurCapture={() => setCalloutActive(false)}>
        <GlobeControl className="globe-frame"
          {...(phone ? { type: "button" as const, "aria-pressed": touchOpen }
            : { href: "https://herdlink.nl", target: "_blank", rel: "noopener noreferrer" })}
          aria-label={phone ? "Enlarge globe" : "Explore HerdLink from the globe (opens in a new tab)"}
          onClick={(event) => {
            if (!window.matchMedia("(hover: none)").matches) return;
            if (phone || !touchOpen) event.preventDefault();
            setTouchOpen(!touchOpen);
          }}>
          <Globe playing={m.playing} visible={m.visible} />
        </GlobeControl>
        <svg className="globe-callout-line" viewBox="0 0 320 320" aria-hidden="true">
          <circle cx="160" cy="160" r="4" />
          <circle className="callout-ring" cx="160" cy="160" r="9" />
          <path d="M160 160 V44" pathLength="1" />
        </svg>
        <ShinyButton className="globe-herdlink" href="https://herdlink.nl" target="_blank" rel="noopener noreferrer"
          aria-label="Open HerdLink (opens in a new tab)" playing={m.playing && (calloutActive || touchOpen)} onClick={() => setTouchOpen(false)}>
          <span className="globe-herdlink-label"><Image src="/herdlink-favicon.ico" width={20} height={20} alt="" unoptimized />Open HerdLink <ArrowUpRight size={16} aria-hidden /></span>
        </ShinyButton>
      </div>


    </div>
  );
}
export function ProfileSocialLinks() {
  return (
      <div className="globe-socials" aria-label="Social profiles">
        {portfolio.profile.links.filter((link) => link.label !== "Email").map((link) => (
          <a key={link.label} href={link.url} aria-label={link.label} title={link.label}>
            {link.label === "GitHub" ? <Github size={20} aria-hidden />
              : link.label === "LinkedIn" ? <Linkedin size={20} aria-hidden />
              : <Fingerprint size={20} aria-hidden />}
          </a>
        ))}
      </div>
  );
}
export function ToolkitCloud() {
  const panel = useRef<HTMLDivElement>(null);
  const m = usePanelMotion(panel, true);
  return (
    <div
      ref={panel}
      data-testid="signature-icon-cloud"
      data-motion-state={m.playing ? "running" : "paused"}
    >
      <IconCloud images={images} playing={m.playing} visible={m.visible} />
    </div>
  );
}
export function Approach() {
  const panel = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const m = usePanelMotion(panel, true);
  const container = useRef<HTMLDivElement>(null),
    a = useRef<HTMLDivElement>(null),
    b = useRef<HTMLDivElement>(null),
    c = useRef<HTMLDivElement>(null),
    d = useRef<HTMLDivElement>(null),
    e = useRef<HTMLDivElement>(null),
    f = useRef<HTMLDivElement>(null);
  const inputs = [
    { ref: a, Icon: GitBranch, label: "Phylogenies" },
    { ref: b, Icon: Network, label: "Temporal networks" },
    { ref: c, Icon: MapPin, label: "Spatial observations" },
  ];
  const outputs = [
    { ref: e, Icon: ChartNoAxesCombined, label: "Scientific insight" },
    { ref: f, Icon: Code2, label: "Research software" },
  ];
  return (
    <div ref={panel} className="research-approach" data-testid="signature-beam"
      data-motion-state={m.playing ? "running" : "paused"}>
      <p className="visual-intro">Understanding life through models.</p>
      <div ref={container} className="approach-network" role="img"
        aria-label="Phylogenies, temporal networks and spatial observations feed models and inference, producing scientific insight and research software.">
        <GlyphMatrix className="approach-glyphs" glyphs="ATCG01·+λΣ∆" cellSize={14}
          color={resolvedTheme === "dark" ? "#ffffff" : resolvedTheme === "light" ? "#000000" : "#6B7280"}
          mutationRate={0.04} interval={90} fadeBottom={0.6}
          playing={m.playing} data-motion-state={m.playing ? "running" : "paused"} />
        <div className="approach-column">
          <LineShadowText className="approach-stage" shadowColor="var(--primary)">Observe</LineShadowText>
          {inputs.map(({ ref, Icon, label }) => <div className="approach-node" key={label}>
            <div ref={ref} className="approach-symbol"><Icon aria-hidden strokeWidth={1.5} /></div>
            <span>{label}</span>
          </div>)}
        </div>
        <div className="approach-node approach-hub">
          <div ref={d} className="approach-symbol">
            <span className="approach-chip-corners" aria-hidden />
            <BrainCircuit aria-hidden strokeWidth={1.25} />
          </div>
          <span><AuroraText colors={["var(--primary)", "var(--approach-green)", "var(--primary)"]}>Models &amp; inference</AuroraText></span>
        </div>
        <div className="approach-column approach-results">
          <LineShadowText className="approach-stage" shadowColor="var(--approach-green)">Understand</LineShadowText>
          {outputs.map(({ ref, Icon, label }) => <div className="approach-node" key={label}>
            <div ref={ref} className="approach-symbol"><Icon aria-hidden strokeWidth={1.5} /></div>
            <span>{label}</span>
          </div>)}
        </div>
        {[[a, d], [b, d], [c, d], [d, e], [d, f]].map(([from, to], i) => (
          <AnimatedBeam key={i} containerRef={container} fromRef={from} toRef={to}
            playing={m.playing} glow curvature={[-24, 0, 24, 22, -22][i]}
            pathColor="var(--approach-green)" pathOpacity={0.3} pathWidth={1.4}
            gradientStartColor="var(--approach-green)" gradientStopColor="var(--approach-light)"
            duration={6} delay={i * 0.65} />
        ))}
      </div>
    </div>
  );
}
const toolCategories: Record<string, string> = {
  evonn: "Neural inference", evesim: "Evolution simulation", netforge: "Contact networks",
  herdlink: "Network exploration", netspectra: "Network statistics", evolab: "Evolution sandbox", miniape: "Phylogenetic utilities",
  treestats: "Tree statistics", ddd: "Diversification", daisie: "Island biodiversity",
};
const technologyIcons = {
  "R": "r.svg", "Python": "python.svg", "PyTorch": "pytorch.svg", "C++": "cpp.svg", "Rcpp": "cpp.svg",
  "Vite": "vite.svg", "React": "react.svg", "JavaScript": "javascript.svg", "D3.js": "d3.svg",
};
const methodIcons = { "Stochastic block models": Network, "Simulation": ChartNoAxesCombined, "Turf.js": MapPin, "Phylogenetics": GitBranch, "Browser tools": Globe2 };
const technologyAbbreviations: Record<string, string> = { "Stochastic block models": "SBM", "Simulation": "Sim", "JavaScript": "JS", "Phylogenetics": "Phylo" };
export function SoftwareTerminal() {
  const panel = useRef<HTMLDivElement>(null);
  const m = usePanelMotion(panel);
  const groups = [
    { title: "Tools I develop", Icon: Package, items: softwareCards.map(s => ({ id: s.id, name: s.title, stack: s.stack, links: s.links })) },
    { title: "Collaborative contributions", Icon: Users, items: portfolio.software.filter(s => s.role === "Collaborator").map(s => ({ id: s.id, name: s.name, stack: s.id === "treestats" ? ["R", "Rcpp", "Phylogenetics"] : ["R", "Rcpp", "Phylogenetics", "Simulation"], links: [{ label: "Source", url: s.url }] })) },
  ];
  return (
    <div ref={panel} data-testid="signature-terminal" data-motion-state={m.playing ? "running" : "static"}>
      <Terminal className="terminal software-terminal" sequence={false}>
        <div className="terminal-command"><TerminalSquare size={16} aria-hidden /><span className="terminal-prompt">$</span>
          {m.playing ? <TypingAnimation duration={30}>software list --all</TypingAnimation> : <span>software list --all</span>}
        </div>
        {groups.map(({ title, Icon, items }, index) => <section className="terminal-group" data-kind={index === 0 ? "developed" : "collaborative"} key={title}>
          <h2><Icon size={16} aria-hidden />{title}<span className="terminal-count">{items.length}</span></h2>
          <div className="terminal-entries">
            {items.map(item => <div className="terminal-entry" key={item.id}>
              <div className="terminal-tool"><span className="terminal-node" aria-hidden /><strong>{item.name}</strong><span className="terminal-category">{toolCategories[item.id]}</span></div>
              <div className="terminal-stack">{item.stack.map(tech => {
                const asset = technologyIcons[tech as keyof typeof technologyIcons];
                const Icon = methodIcons[tech as keyof typeof methodIcons];
                return <span className="terminal-tech" key={tech}>
                  {asset ? <Image src={`/icons/toolkit/${asset}`} width={14} height={14} alt="" /> : <Icon size={14} aria-hidden />}
                  {technologyAbbreviations[tech] ? <abbr title={tech} aria-label={tech}>{technologyAbbreviations[tech]}</abbr> : tech}
                </span>;
              })}</div>
              <div className="terminal-links">{item.links.map(link => <a key={link.url} href={link.url} aria-label={`${item.name} ${link.label}`} title={`${item.name} ${link.label}`}>
                {link.label === "Source" ? <Github size={17} aria-hidden /> : <Globe2 size={17} aria-hidden />}
              </a>)}</div>
            </div>)}
          </div>
        </section>)}
        <div className="terminal-summary"><span aria-hidden>✓</span> {groups.reduce((total, group) => total + group.items.length, 0)} projects · open source & research software</div>
      </Terminal>
    </div>
  );
}
