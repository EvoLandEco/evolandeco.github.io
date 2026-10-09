"use client";
import { useLayoutEffect, useRef } from "react";

export function useAtlasMasonry(expanded: boolean, content: unknown, minimumWidth: number) {
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const container = list.current;
    if (!container || expanded) return;
    const cards = [...container.querySelectorAll<HTMLElement>(":scope > article")];
    if (!cards.length) return;
    const arrange = () => {
      const width = container.getBoundingClientRect().width;
      if (!width) return;
      const gap = 12, columns = Math.max(1, Math.floor((width + gap) / (minimumWidth + gap)));
      const columnWidth = (width - gap * (columns - 1)) / columns;
      cards.forEach(card => { card.style.width = `${columnWidth}px`; });
      const heights = cards.map(card => card.getBoundingClientRect().height);
      const bottoms = Array<number>(columns).fill(0);
      cards.forEach((card, index) => {
        const column = bottoms.indexOf(Math.min(...bottoms));
        card.style.position = "absolute";
        card.style.left = `${column * (columnWidth + gap)}px`;
        card.style.top = `${bottoms[column]}px`;
        bottoms[column] += heights[index] + gap;
      });
      container.style.height = `${Math.max(...bottoms) - gap}px`;
    };
    arrange();
    let frame = 0;
    const observer = new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(arrange); });
    observer.observe(container);
    cards.forEach(card => observer.observe(card));
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      container.style.removeProperty("height");
      cards.forEach(card => ["width", "position", "left", "top"].forEach(property => card.style.removeProperty(property)));
    };
  }, [expanded, content, minimumWidth]);
  return list;
}
