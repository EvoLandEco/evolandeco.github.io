// Adapted from Magic UI Lens (MIT). See LICENSE-MAGICUI.md.
// Source: https://magicui.design/r/lens.json
// Upstream SHA-256: 85e2ae91387ee22d1492224e5767788653b5954a2d65ec0fd59ca023dae6f0e3
"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

export function Lens({ children }: { children: ReactNode }) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const reduced = useReducedMotion();
  const diameter = 150;
  return <div className="album-lens"
    onPointerMove={event => {
      if (event.pointerType === "touch") return;
      const rect = event.currentTarget.getBoundingClientRect();
      setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }}
    onPointerLeave={() => setPosition(null)}>
    {children}
    <AnimatePresence>
      {position && <motion.div className="album-lens-overlay" aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: reduced ? 0 : .16 }}>
        <div className="album-lens-magnification" style={{
          clipPath: `circle(${diameter / 2}px at ${position.x}px ${position.y}px)`,
        }}>
          <div className="album-lens-image" style={{ transform: "scale(1.6)", transformOrigin: `${position.x}px ${position.y}px` }}>{children}</div>
        </div>
        <div className="album-lens-ring" style={{ width: diameter, height: diameter, left: position.x - diameter / 2, top: position.y - diameter / 2 }} />
      </motion.div>}
    </AnimatePresence>
  </div>;
}
