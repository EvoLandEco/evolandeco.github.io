"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
const subscribe = () => () => {};
export function LegacyArticle({
  slug,
  title,
  html,
}: {
  slug: string;
  title: string;
  html: string;
}) {
  const enhanced = useSyncExternalStore(
      subscribe,
      () => true,
      () => false,
    ),
    frame = useRef<HTMLIFrameElement>(null),
    [height, setHeight] = useState(1200);
  useEffect(() => {
    const resize = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== frame.current?.contentWindow ||
        event.data?.type !== "article-size" ||
        !Number.isFinite(event.data.height) ||
        event.data.height <= 0
      )
        return;
      setHeight(event.data.height);
    };
    window.addEventListener("message", resize);
    return () => window.removeEventListener("message", resize);
  }, []);
  return enhanced ? (
    <iframe
      ref={frame}
      title={title}
      src={`/reading/${slug}.html`}
      style={{ width: "100%", height, border: 0, display: "block" }}
    />
  ) : (
    <div className="article-copy" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
