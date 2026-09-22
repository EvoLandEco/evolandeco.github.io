"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { AnimatedThemeToggler } from "./magicui/animated-theme-toggler";
import { useTheme } from "next-themes";
function subscribeMotion(notify: () => void) {
  const q = matchMedia("(prefers-reduced-motion: reduce)");
  q.addEventListener("change", notify);
  document.addEventListener("visibilitychange", notify);
  return () => {
    q.removeEventListener("change", notify);
    document.removeEventListener("visibilitychange", notify);
  };
}
function getMotionSnapshot() {
  return (
    !document.hidden && !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
const Policy = createContext(false);
export function MotionPolicy({ children }: { children: ReactNode }) {
  const allowed = useSyncExternalStore(
    subscribeMotion,
    getMotionSnapshot,
    () => false,
  );
  return <Policy.Provider value={allowed}>{children}</Policy.Provider>;
}
const subscribeThemeMount = () => () => {};
export function Settings() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeThemeMount, () => true, () => false);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <AnimatedThemeToggler className="appearance-widget" role="switch"
      theme={dark ? "dark" : "light"} onThemeChange={setTheme}
      aria-label="Dark mode" aria-checked={dark}
      title={dark ? "Switch to light mode" : "Switch to dark mode"} />
  );
}
export function usePanelMotion(ref: React.RefObject<HTMLDivElement | null>, loop = false) {
  const policy = useContext(Policy);
  const [visible, setVisible] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (!visible || !policy || loop) return;
    const timer = setTimeout(() => setFinished(true), 4500);
    return () => clearTimeout(timer);
  }, [visible, policy, loop]);
  useEffect(() => {
    const observer = new IntersectionObserver(([e]) =>
      setVisible(e.isIntersecting),
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return {
    visible,
    playing: policy && visible && (loop || !finished),
  };
}
