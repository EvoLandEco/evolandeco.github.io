import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

export function useAtlasContentMotion(root: RefObject<HTMLElement | null>, selection: string) {
  const previous = useRef(selection);
  const animation = useRef<Animation | null>(null);
  useLayoutEffect(() => {
    if (previous.current === selection) return;
    previous.current = selection;
    const element = root.current;
    if (!element) return;
    const running = animation.current?.playState === "running";
    const style = getComputedStyle(element);
    const from = { opacity: running ? style.opacity : ".6", transform: running ? style.transform : "translateY(6px)" };
    animation.current?.cancel();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.atlasReportsTransition) return;
    animation.current = element.animate([from, { opacity: 1, transform: "none" }], {
      id: "atlas-content-change", duration: 360, easing: "cubic-bezier(.22,.8,.2,1)",
    });
  }, [root, selection]);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => animation.current?.cancel();
    motion.addEventListener("change", stop);
    return () => { motion.removeEventListener("change", stop); stop(); };
  }, []);
}
