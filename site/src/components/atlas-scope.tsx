"use client";
import { useRef, useState, useLayoutEffect, type ReactNode } from "react";
import { Info, X, type LucideIcon } from "lucide-react";
import { CountryText } from "./atlas-location-badges";

export function AtlasScope({ label, title, children, buttonLabel, icon: Icon = Info }: { label: string; title: string; children: ReactNode; buttonLabel?: string; icon?: LucideIcon }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const name = buttonLabel ?? `${label} for ${title}`;
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  return <>
    <button className={buttonLabel ? "atlas-dataset-button" : "atlas-scope-trigger"} aria-label={buttonLabel ?? name} title={buttonLabel ?? label} aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setOpen(true); }}>{buttonLabel ? <><Icon size={15} aria-hidden />{buttonLabel}</> : "?"}</button>
    {open && <dialog ref={dialog} className={`atlas-scope-dialog${buttonLabel ? " atlas-about-dialog" : ""}`} aria-label={name} onClose={event => { if (event.target === event.currentTarget) setOpen(false); }} onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], summary, input, select, textarea, [tabindex="0"]')].filter(element => element.getClientRects().length > 0 && element.closest('dialog') === event.currentTarget);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
    }}>
      <header>{buttonLabel ? <h2><Icon size={20} aria-hidden />{buttonLabel}</h2> : <div><span>{label}</span><h2><CountryText>{title}</CountryText></h2></div>}<button autoFocus aria-label={buttonLabel ? `Close ${buttonLabel}` : `Close ${label.toLowerCase().replace("&", "and")}`} onClick={() => dialog.current?.close()}><X size={18} aria-hidden /></button></header>
      <div className="atlas-scope-body">{children}</div>
    </dialog>}
  </>;
}
