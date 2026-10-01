"use client";
import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AtlasWorkspaceContext } from "./atlas-context";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { AtlasSelect } from "./atlas-select";

export function ReportPagination({ position, index, items, onChange, entity = "Report" }: {
  entity?: "Report" | "Geographic link" | "Assessment" | "Topic" | "One Health overview";
  position: "top" | "bottom"; index: number; items: { value: string; label: string }[]; onChange: (index: number) => void;
}) {
  const fullscreen = useContext(AtlasWorkspaceContext);
  const host = useRef<HTMLSpanElement>(null);
  const nav = useRef<HTMLElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!fullscreen) setTarget(host.current?.closest<HTMLElement>(".atlas-page") ?? null);
  }, [fullscreen]);
  useEffect(() => {
    if (fullscreen || !target || !nav.current) return;
    const control = nav.current;
    const workspace = host.current!.closest<HTMLElement>(".atlas-workspace")!;
    const toolbar = workspace.querySelector<HTMLElement>(".atlas-toolbar")!;
    const dock = document.querySelector<HTMLElement>(".site-dock");
    let frame = 0;
    const place = () => {
      frame = 0;
      const bounds = workspace.getBoundingClientRect();
      const menu = toolbar.getBoundingClientRect();
      const dockTop = dock && getComputedStyle(dock).position === "fixed" ? dock.getBoundingClientRect().top : innerHeight;
      const top = Math.max(menu.bottom + 16, 16);
      const bottom = Math.min(innerHeight - 16, dockTop - 16, bounds.bottom - 16);
      const height = control.offsetHeight;
      control.style.visibility = menu.top <= 80 && bottom - top >= height ? "visible" : "hidden";
      control.style.top = `${top + Math.max(0, (bottom - top - height) / 2)}px`;
      const beside = innerWidth - bounds.right >= 68;
      control.style.right = `${beside ? innerWidth - bounds.right - 60 : 8}px`;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };
    const resize = new ResizeObserver(schedule);
    [control, workspace, toolbar, ...(dock ? [dock] : [])].forEach(element => resize.observe(element));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    place();
    return () => {
      cancelAnimationFrame(frame); resize.disconnect();
      window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule);
    };
  }, [fullscreen, target]);
  const Previous = fullscreen ? ChevronLeft : ChevronUp;
  const Next = fullscreen ? ChevronRight : ChevronDown;
  const placement = fullscreen ? position : "side";
  const content = <nav ref={nav} className="atlas-pagination" data-floating={!fullscreen || undefined} aria-label={`${entity} pages, ${placement}`}>
    <button aria-label={`Previous ${entity.toLowerCase()} page`} disabled={index === 0} onClick={() => onChange(index - 1)}><Previous size={16} aria-hidden /></button>
    <AtlasSelect label={`${entity} page, ${placement}`} value={String(index)} items={items} summaryLabel={fullscreen ? undefined : <span className="atlas-page-number"><strong>{index + 1}</strong><small> / {items.length}</small></span>} onChange={value => onChange(Number(value))} />
    <button aria-label={`Next ${entity.toLowerCase()} page`} disabled={index === items.length - 1} onClick={() => onChange(index + 1)}><Next size={16} aria-hidden /></button>
  </nav>;
  return fullscreen ? content : <><span ref={host} hidden />{target && createPortal(content, target)}</>;
}

