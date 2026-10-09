"use client";
import { cardTransitionClips, clipCardTransition } from "./atlas-card-transition";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { motion as m, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ChevronsDown, Expand } from "lucide-react";

import { useAtlasMasonry } from "./use-atlas-masonry";

const CardContext = createContext<{ expanded: string | null; transitioning: string | null; label: string; change: (id: string | null) => void } | null>(null);

export function AtlasConnectionCards({ ids, selectedId, label, children }: { ids: string[]; selectedId: string; label: string; children: ReactNode }) {
  const root = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState<string | null>(ids.includes(selectedId) ? selectedId : null);
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [selection, setSelection] = useState(selectedId);
  const [more, setMore] = useState(false);
  const cue = useRef<HTMLButtonElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const cards = useAtlasMasonry(!!expanded, children, 300);
  const position = useRef({ panel: 0, page: 0 });
  const active = useRef<{ transition: ViewTransition; clear: () => void } | null>(null);
  if (selection !== selectedId) { setSelection(selectedId); setExpanded(ids.includes(selectedId) ? selectedId : null); }
  if (expanded && !ids.includes(expanded)) setExpanded(null);
  useEffect(() => () => { active.current?.transition.skipTransition(); active.current?.clear(); }, []);
  useEffect(() => {
    const element = expanded ? root.current?.querySelector<HTMLElement>('[data-expanded="true"] .atlas-card-body') : scroll.current;
    if (!element) return;
    const update = () => {
      const next = Math.ceil(element.scrollTop) < element.scrollHeight - element.clientHeight;
      if (!next && document.activeElement === cue.current) element.focus({ preventScroll: true });
      setMore(next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    [...element.children].forEach(child => observer.observe(child));
    element.addEventListener("scroll", update, { passive: true }); update();
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [expanded, children]);
  function change(id: string | null) {
    const target = id ?? expanded;
    if (!target || !root.current) return;
    const panel = scroll.current;
    const selector = `[data-card-id="${CSS.escape(target)}"]`;
    const card = root.current.querySelector<HTMLElement>(selector);
    if (!card) return;
    const update = () => {
      flushSync(() => setExpanded(id));
      if (id) {
        panel?.scrollTo({ top: 0, behavior: "instant" });
        root.current?.querySelector<HTMLElement>('[data-expanded="true"] .atlas-card-body')?.scrollTo({ top: 0 });
        if (!root.current?.closest(".atlas-page[data-fullscreen]")) root.current?.closest(".atlas-analysis, .atlas-chain-digests")?.scrollIntoView({ block: "start", behavior: "instant" });
      } else {
        panel?.scrollTo({ top: position.current.panel, behavior: "instant" });
        window.scrollTo({ top: position.current.page, behavior: "instant" });
      }
      root.current?.querySelector<HTMLButtonElement>(`${selector} [data-card-${id ? "back" : "expand"}]`)?.focus({ preventScroll: true });
    };
    active.current?.transition.skipTransition(); active.current?.clear(); active.current = null;
    if (id) {
      const analysis = root.current.closest<HTMLElement>(".atlas-analysis");
      if (analysis && panel) {
        if (!analysis.closest(".atlas-page[data-fullscreen]")) analysis.scrollIntoView({ block: "start", behavior: "instant" });
        panel.scrollTo({ top: panel.scrollTop + card.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientTop, behavior: "instant" });
      }
      position.current = { panel: panel?.scrollTop ?? 0, page: window.scrollY };
    }
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) { update(); return; }
    // The native transition owns the selected card’s position.
    flushSync(() => setTransitioning(target));
    const named = new Set<HTMLElement>();
    const name = () => {
      const card = root.current?.querySelector<HTMLElement>(selector);
      if (!card) return;
      card.style.viewTransitionName = "atlas-connection-card"; named.add(card);
      card.querySelectorAll<HTMLElement>("[data-card-part]").forEach(part => { part.style.viewTransitionName = `atlas-connection-${part.dataset.cardPart}`; named.add(part); });
    };
    document.documentElement.dataset.atlasConnectionTransition = id ? "expand" : "collapse";
    name();
    const cardClips = () => cardTransitionClips(card);
    const before = cardClips();
    let after = before;
    const transition = document.startViewTransition(() => { update(); name(); after = cardClips(); });
    const clearClips = clipCardTransition(transition, before, () => after);
    const clear = () => { setTransitioning(null); clearClips(); named.forEach(element => element.style.removeProperty("view-transition-name")); delete document.documentElement.dataset.atlasConnectionTransition; };
    active.current = { transition, clear };
    const finish = () => { if (active.current?.transition === transition) { clear(); active.current = null; } };
    void transition.finished.then(finish, finish);
  }
  return <CardContext value={{ expanded, transitioning, label, change }}><section ref={root} className="atlas-connection-workspace" data-expanded={!!expanded || undefined} aria-label={label} onKeyDown={event => {
    if (event.key === "Escape" && expanded && !event.defaultPrevented && !(event.target as HTMLElement).closest('dialog, .atlas-select[open]')) { event.preventDefault(); event.stopPropagation(); change(null); }
  }}>
    <div ref={scroll} className="atlas-connection-scroll" tabIndex={expanded ? undefined : 0} aria-label={expanded ? undefined : label}>
      <div ref={cards} className="atlas-connection-cards">{children}</div>
    </div>
    <button ref={cue} className="atlas-scroll-cue" data-more={more} tabIndex={more ? 0 : -1} aria-hidden={!more} aria-label={expanded ? "More details below" : `More ${label.toLowerCase()} below`} onClick={() => {
      const element = expanded ? root.current?.querySelector<HTMLElement>('[data-expanded="true"] .atlas-card-body') : scroll.current;
      element?.scrollBy({ top: element.clientHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }}><ChevronsDown size={18} aria-hidden /></button>
  </section></CardContext>;
}

export function AtlasConnectionCard({ id, label, selected, linkId, assessmentId, kind, heading, actions, children, detailsLabel = "Connection details" }: {
  id: string; label: string; selected: boolean; linkId?: string; assessmentId?: string; kind?: string; heading: ReactNode; actions: ReactNode; children: (expanded: boolean) => ReactNode; detailsLabel?: string;
}) {
  const context = useContext(CardContext)!;
  const expanded = context.expanded === id;
  const reducedMotion = useReducedMotion();
  return <m.article layout={reducedMotion || context.transitioning === id ? false : "position"} initial={reducedMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : -12 }} className="atlas-connection atlas-evidence-card" data-card-id={id} data-link-id={linkId} data-assessment-id={assessmentId} data-kind={kind} data-selected={selected} data-expanded={expanded || undefined} hidden={!!context.expanded && !expanded} aria-label={label}>
    {expanded && <div className="atlas-card-back"><button className="atlas-watch-close" data-card-back data-card-part="control" onClick={() => context.change(null)}><ArrowLeft size={15} aria-hidden />Back to {context.label.toLowerCase()}</button></div>}
    <header id={assessmentId ? `atlas-assessment-${assessmentId}` : undefined} className="atlas-entry-heading atlas-card-heading" data-card-part="heading" tabIndex={-1}>{heading}</header>
    <div className="atlas-card-body" role={expanded ? "region" : undefined} aria-label={expanded ? detailsLabel : undefined} tabIndex={expanded ? 0 : undefined}>{children(expanded)}</div>
    <footer className="atlas-card-footer">
      {!expanded && <button className="atlas-card-expand" data-card-expand data-card-part="control" onClick={() => context.change(id)}><Expand size={14} aria-hidden />View details<ArrowRight size={14} aria-hidden /></button>}
      {actions}
    </footer>
  </m.article>;
}
