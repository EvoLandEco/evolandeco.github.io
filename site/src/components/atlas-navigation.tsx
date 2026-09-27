"use client";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const AtlasNavigation = createContext({ arriving: false, transitioning: false, open: (_event: MouseEvent<HTMLAnchorElement>) => {} });
export const useAtlasNavigation = () => useContext(AtlasNavigation);

export function AtlasNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const committed = useRef<(() => void) | null>(null);
  const [destination, setDestination] = useState("");
  const transitioning = destination !== "";
  const arriving = destination === "/atlas/";
  useLayoutEffect(() => {
    if (!committed.current) return;
    const resolve = committed.current;
    committed.current = null;
    resolve();
  }, [path]);
  useEffect(() => () => committed.current?.(), []);
  function open(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = new URL(event.currentTarget.href).pathname;
    const toAtlas = target === "/atlas/" || target === "/atlas";
    const toHome = target === "/" && path.startsWith("/atlas");
    if ((!toAtlas && !toHome) || (toAtlas && path.startsWith("/atlas"))) return;
    event.preventDefault();
    if (transitioning) return;
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(target);
      return;
    }
    setDestination(toAtlas ? "/atlas/" : "/");
    document.documentElement.dataset.atlasTransition = "active";
    const transition = document.startViewTransition(() => new Promise<void>((resolve) => {
      committed.current = resolve;
      router.push(target);
    }));
    const finish = () => {
      delete document.documentElement.dataset.atlasTransition;
      setDestination("");
    };
    void transition.finished.then(finish, finish);
  }
  return <AtlasNavigation.Provider value={{ arriving, transitioning, open }}>{children}</AtlasNavigation.Provider>;
}
