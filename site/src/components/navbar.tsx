"use client";
import { useSyncExternalStore } from "react";
import { Tooltip, TooltipArrow, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import Link from "next/link";
import { ProfileCard } from "./profile-card";
import portfolio from "@/content-data/portfolio.json";
import { usePathname } from "next/navigation";
import { House, FlaskConical, BookOpen, Code2, MapPin, NotebookPen, FileDown, Mail, Clock3 } from "lucide-react";
import { Dock, DockIcon } from "./magicui/dock";
import data from "@/content-data/ui-content.json";
const icons = [House, FlaskConical, BookOpen, Code2, NotebookPen, MapPin];
function subscribeWidth(notify: () => void) {
  const media = matchMedia("(min-width: 768px)");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", notify);
  motion.addEventListener("change", notify);
  return () => { media.removeEventListener("change", notify); motion.removeEventListener("change", notify); };
}
export default function Navbar() {
  const path = usePathname();
  const pageLabel = path === "/" ? "About me"
    : path.startsWith("/research") ? "Research"
    : path.startsWith("/publications") ? "Publications"
    : path.startsWith("/software") ? "Software"
    : path.startsWith("/blog") || path.startsWith("/writing") ? "Blog"
    : path.startsWith("/photography") ? "Footprint"
    : data.navigation.find((item) => item.path === path)?.label;

  const reduced = useSyncExternalStore(subscribeWidth, () => matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const wide = useSyncExternalStore(subscribeWidth, () => matchMedia("(min-width: 768px)").matches, () => true);
  return (
    <nav aria-label="Primary" data-testid="primary-navigation">
      <TooltipProvider delayDuration={180}>
      <Dock className="site-dock" magnification={60} animated={!wide && !reduced}
        leading={<ProfileCard />}
        mobileLabel={pageLabel}
        trailing={<>
          <a className="header-action cv-action" href={portfolio.profile.cvUrl} download aria-label="Download CV" title="Download CV">
            <FileDown size={18} aria-hidden /><span>Download CV</span>
          </a>
          <a className="header-action contact-action" href={`mailto:${portfolio.profile.email}`} aria-label="Get in touch" title="Get in touch">
            <Mail size={18} aria-hidden /><span>Get in touch</span>
          </a>
        </>}
      >
        {data.navigation.map((n, i) => {
          const Icon = icons[i];
          const active =
            n.path === "/" ? path === "/" : path.startsWith(n.path) || (n.path === "/blog" && path.startsWith("/writing"));
          return (
            <Tooltip key={n.path}>
              <TooltipTrigger asChild>
                {n.migrating ? <span className="nav-migrating" role="link" aria-disabled="true" tabIndex={0} aria-label={`${n.label} · Migrating`} title={`${n.label} · Migrating`}>
                  <DockIcon className="nav-item"><Icon aria-hidden className="dock-glyph" /></DockIcon>
                  <Clock3 className="migration-mark" size={12} aria-hidden />
                </span> : <Link href={n.path} aria-label={n.label} aria-current={active ? "page" : undefined}>
                  <DockIcon className="nav-item">
                    <Icon aria-hidden className="dock-glyph" />
                  </DockIcon>
                </Link>}
              </TooltipTrigger>
              <TooltipContent side={wide ? "bottom" : "top"} sideOffset={10} className="dock-tooltip">
                {n.label}{n.migrating && <span> · Migrating</span>}<TooltipArrow />
              </TooltipContent>
            </Tooltip>
          );
        })}
      </Dock>
      </TooltipProvider>
    </nav>
  );
}
