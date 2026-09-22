"use client";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { FileDown, Mail, MapPin } from "lucide-react";
import { MagicCard } from "./magicui/magic-card";
import data from "@/content-data/portfolio.json";

export function ProfileCard() {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pinned = useRef(false);
  const [open, setOpen] = useState(false);
  const cancelClose = () => clearTimeout(timer.current);
  const show = () => {
    cancelClose();
    if (!trigger.current || !card.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 32);
    card.current.style.left = `${Math.max(16, Math.min(rect.left, window.innerWidth - width - 16))}px`;
    card.current.style.top = `${rect.bottom + 12}px`;
    card.current.showPopover();
  };
  const leave = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!pinned.current && !card.current?.contains(document.activeElement)) card.current?.hidePopover();
    }, 180);
  };
  useEffect(() => {
    const close = () => card.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => { clearTimeout(timer.current); window.removeEventListener("resize", close); };
  }, []);
  return <>
    <button ref={trigger} className="header-portrait profile-trigger" aria-label="About Tianjian Qin"
      aria-expanded={open} aria-controls={id} popoverTarget={id}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") show(); }}
      onPointerLeave={leave}
      onClick={(e) => {
        e.preventDefault();
        if (pinned.current) card.current?.hidePopover();
        else { pinned.current = true; show(); }
      }}>
      <Image src="/portrait.png" alt="Tianjian Qin" width={116} height={116} sizes="58px" priority />
    </button>
    <div ref={card} id={id} popover="auto" className="profile-popover" role="region" aria-label="Tianjian Qin profile"
      onPointerEnter={cancelClose} onPointerLeave={leave}
      onToggle={(e) => { const shown = e.newState === "open"; setOpen(shown); if (!shown) pinned.current = false; }}>
      <MagicCard className="profile-magic-card" gradientFrom="#719ddd" gradientTo="#80b9a8" gradientColor="#609dc5" gradientOpacity={0.13} gradientSize={240}>
        <div className="profile-card-cover" aria-hidden="true"><span /><span /><span /><span /></div>
        <div className="profile-card-content">
          <Image className="profile-card-photo" src="/portrait.png" alt="" width={144} height={144} sizes="72px" />
          <h2>{data.profile.name} <span>PhD</span></h2>
          <p className="profile-identification">{data.profile.title}</p>
          <div className="profile-position">
            <Image src="/logos/wur-symbol.svg" alt="" width={90} height={30} unoptimized />
            <div><strong>{data.profile.role}</strong><p>{data.profile.affiliation}</p></div>
          </div>
          <p className="profile-group">{data.profile.group}</p>
          <p className="profile-country"><MapPin size={14} aria-hidden />{data.profile.country}</p>
          <div className="profile-card-actions">
            <a href={data.profile.cvUrl} download><FileDown size={16} aria-hidden />Download CV</a>
            <a href={`mailto:${data.profile.email}`}><Mail size={16} aria-hidden />Get in touch</a>
          </div>
        </div>
      </MagicCard>
    </div>
  </>;
}
