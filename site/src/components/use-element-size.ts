import { useCallback, useState } from "react";

export function useElementSize<T extends Element>() {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const ref = useCallback((element: T | null) => {
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize(current => current?.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}
