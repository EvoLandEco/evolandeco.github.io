"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Activity, CalendarDays, Check, ChevronDown, GitBranch, Layers3, MapPin, Search } from "lucide-react";

const badgeIcons = { disease: Activity, place: MapPin, period: CalendarDays, kind: GitBranch, count: Layers3 };
export type AtlasSelectItem = { value: string; label: string; title?: string; badges?: { label: string; kind: keyof typeof badgeIcons }[] };

function Choice({ item }: { item: AtlasSelectItem }) {
  if (!item.badges) return <span>{item.label}</span>;
  return <span className="atlas-select-choice"><span className="atlas-select-choice-title">{item.title ?? item.label}</span><span className="atlas-select-badges">{item.badges.map((badge, index) => {
    const Icon = badgeIcons[badge.kind];
    return <span key={`${badge.kind}:${index}`} className="atlas-select-badge" data-kind={badge.kind}><Icon size={12} aria-hidden />{badge.label}</span>;
  })}</span></span>;
}

type SelectProps = {
  label: string; searchable?: boolean; items: AtlasSelectItem[];
} & ({ multiple: true; value: string[]; onChange: (value: string[]) => void }
  | { multiple?: false; value: string; onChange: (value: string) => void });

export function AtlasSelect(props: SelectProps) {
  const { label, value, items, searchable = false, multiple = false } = props;
  const selected = Array.isArray(value) ? value : [value];
  const selectedLabels = items.filter(item => selected.includes(item.value)).map(item => item.label);
  const selectedItem = !multiple ? items.find(item => item.value === value) : undefined;
  const summary = multiple ? selected.length ? selectedLabels.length === 1 ? selectedLabels[0] : `${selected.length} selected` : items[0]?.label : selectedLabels[0];
  function pick(item: string) {
    if (props.multiple) props.onChange(item === items[0].value ? [] : selected.includes(item) ? selected.filter(id => id !== item) : [...selected, item]);
    else { props.onChange(item); close(); }
  }
  const root = useRef<HTMLDetailsElement>(null);
  const search = useRef({ text: "", time: 0 });
  const id = useId();
  const [query, setQuery] = useState("");
  const choices = items.filter(item => item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) root.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  function close() {
    if (root.current) { root.current.open = false; root.current.querySelector("summary")?.focus(); }
  }
  return <details className="atlas-select" data-structured={items.some(item => item.badges) || undefined} ref={root} onToggle={event => {
    if (!event.currentTarget.open) setQuery("");
    else if (searchable) root.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    else if (document.activeElement === root.current?.querySelector("summary")) root.current?.querySelector<HTMLElement>('[aria-selected="true"], input:checked')?.focus();
  }} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "Tab") { if (root.current) root.current.open = false; return; }
    const options = [...(root.current?.querySelectorAll<HTMLElement>(multiple ? 'input[type="checkbox"]' : '[role="option"]') ?? [])];
    const focused = options.indexOf(document.activeElement as HTMLButtonElement);
    const typing = event.target instanceof HTMLInputElement && event.target.type === "search";
    if (multiple && !typing && event.key === "Enter" && focused >= 0) { event.preventDefault(); options[focused].click(); return; }
    if (typing && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const index = typing ? -1 : focused < 0 ? choices.findIndex(item => selected.includes(item.value)) : focused;
    let next = event.key === "ArrowDown" ? (index + 1) % options.length
      : event.key === "ArrowUp" ? (index < 0 ? options.length - 1 : (index + options.length - 1) % options.length)
      : event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : -1;
    if (!typing && event.key.length === 1 && event.key !== " ") {
      const time = event.timeStamp;
      search.current = { text: (time - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase(), time };
      next = choices.findIndex(item => item.label.toLowerCase().startsWith(search.current.text));
    }
    if (next >= 0) {
      event.preventDefault();
      if (root.current) root.current.open = true;
      options[next]?.focus();
    }
  }}>
    <summary aria-label={label} aria-haspopup={multiple ? "dialog" : "listbox"} aria-controls={id}>
      <span title={selectedLabels.join(", ")}>{selectedItem?.badges ? <Choice item={selectedItem} /> : summary}</span><ChevronDown size={14} aria-hidden />
    </summary>
    <div className="atlas-select-options" role={multiple ? "dialog" : undefined} aria-label={multiple ? label : undefined}>
      {searchable && <label className="atlas-select-search"><Search size={15} aria-hidden /><input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder="Search…" value={query} onChange={event => setQuery(event.target.value)} /></label>}
      <div id={id} role={multiple ? "group" : "listbox"} aria-label={label}>
      {choices.map(item => multiple ? <label key={item.value} className="atlas-select-check">
        <input type="checkbox" checked={item.value === items[0].value ? selected.length === 0 : selected.includes(item.value)} tabIndex={-1} onChange={() => pick(item.value)} /><span>{item.label}</span>
      </label> : <button key={item.value} type="button" role="option" aria-label={item.label} aria-selected={item.value === value} tabIndex={-1}
        onClick={() => pick(item.value)}><Choice item={item} />{item.value === value && <Check size={14} aria-hidden />}</button>)}
      </div>
      {choices.length === 0 && <p className="atlas-select-empty" role="status">No matches</p>}
    </div>
  </details>;
}
