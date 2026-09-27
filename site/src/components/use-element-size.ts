import { useLayoutEffect, useRef, useState } from "react";

export function useElementSize<T extends Element>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width), height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0) setSize(current => current?.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);
  return { ref, size };
}
