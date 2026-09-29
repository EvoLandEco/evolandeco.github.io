"use client";
import { useRef, useState, useLayoutEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { CountryText } from "./atlas-location-badges";

export function AtlasScope({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const name = `${label} for ${title}`;
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => { if (open) dialog.current?.showModal(); }, [open]);
  return <>
    <button className="atlas-scope-trigger" aria-label={name} title={label} aria-haspopup="dialog" onClick={event => { event.currentTarget.focus({ preventScroll: true }); setOpen(true); }}>?</button>
    <dialog ref={dialog} className="atlas-scope-dialog" aria-label={name} onClose={() => setOpen(false)} onKeyDown={event => {
      event.stopPropagation();
      if (event.key !== "Tab") return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }} onClick={event => {
      if (event.target !== event.currentTarget) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close();
    }}>
      <header><div><span>{label}</span><h2><CountryText>{title}</CountryText></h2></div><button autoFocus aria-label={`Close ${label.toLowerCase().replace("&", "and")}`} onClick={() => dialog.current?.close()}><X size={18} aria-hidden /></button></header>
      <div className="atlas-scope-body">{open && children}</div>
    </dialog>
  </>;
}
