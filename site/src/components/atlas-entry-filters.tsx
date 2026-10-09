"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

export function AtlasEntryFilters({ label, value, onChange, groups, count, total }: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  groups: { label: string; match: "any" | "all"; items: { value: string; label: string }[] }[];
  count: number;
  total: number;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const id = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const trigger = root.current?.querySelector("summary")?.getBoundingClientRect();
      const popup = menu.current;
      if (!trigger || !popup) return;
      const height = Math.min(460, popup.querySelector("header")!.offsetHeight + popup.lastElementChild!.scrollHeight + 2);
      const above = trigger.top - 19;
      const below = window.innerHeight - trigger.bottom - 19;
      const upward = height > below && above > below;
      popup.dataset.side = upward ? "above" : "below";
      popup.style.maxHeight = `${Math.max(0, Math.min(height, upward ? above : below))}px`;
    };
    position();
    window.addEventListener("resize", position);
    document.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      document.removeEventListener("scroll", position, true);
    };
  }, [open, groups]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) root.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <details ref={root} className="atlas-entry-filters" data-active={value.length > 0} onToggle={event => setOpen(event.currentTarget.open)} onKeyDown={event => {
    if (event.key === "Escape" && event.currentTarget.open) {
      event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false;
      event.currentTarget.querySelector("summary")?.focus();
    }
  }} onBlur={event => {
    // Safari focuses the enclosing scroll region when a checkbox is clicked.
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget) && !event.relatedTarget.contains(event.currentTarget)) event.currentTarget.open = false;
  }}>
    <summary aria-label={`${label}${value.length ? `: ${value.length} active` : ""}`} aria-controls={id} title={label}>
      <SlidersHorizontal size={15} aria-hidden />{value.length > 0 && <b>{value.length}</b>}
    </summary>
    <div ref={menu} id={id} className="atlas-select-options atlas-entry-filter-menu" role="group" aria-label={label}>
      <header><div><strong>Filter entries</strong><span role="status">{count} of {total} shown</span></div>
        <button type="button" disabled={!value.length} onClick={() => onChange([])}><RotateCcw size={13} aria-hidden />Clear</button>
      </header>
      <div className="atlas-entry-filter-groups">
        {groups.map(group => <fieldset key={group.label}><legend>{group.label}<small>{group.match === "all" ? "Match all" : "Match any"}</small></legend>
          {group.items.map(item => <label key={item.value} className="atlas-select-check"><input type="checkbox" checked={value.includes(item.value)} onChange={() => onChange(value.includes(item.value) ? value.filter(v => v !== item.value) : [...value, item.value])} /><span>{item.label}</span></label>)}
        </fieldset>)}
        <p>Each matching entry keeps its full evidence.</p>
      </div>
    </div>
  </details>;
}
