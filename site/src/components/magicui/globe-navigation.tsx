"use client";

import { useLayoutEffect, useRef } from "react";
import "./globe-navigation.css";

export function GlobeDragHint({ visible, onComplete }: { visible: boolean; onComplete: () => void }) {
  const hint = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const update = () => { if (hint.current) hint.current.dataset.active = String(visible && !document.hidden); };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [visible]);
  return <div ref={hint} className="globe-drag-hint" data-active="false" aria-hidden="true" onAnimationEnd={event => {
    if (event.target === event.currentTarget && event.animationName === "globe-hint-lifetime") onComplete();
  }}>
    <div className="globe-hint-capsule">Drag to rotate</div>
  </div>;
}
