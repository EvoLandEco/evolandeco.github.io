"use client";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";

const origin = "https://atlas-reviewer-inbox.evolandeco-github-io.workers.dev";

export function AtlasReviewer({ hidden }: { hidden: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin === origin && event.source === frame.current?.contentWindow && event.data?.type === "atlas-review-ready") setReady(event.data.ready === true);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "atlas-review-theme", theme: resolvedTheme === "dark" ? "dark" : "light" }, origin);
  }, [ready, resolvedTheme]);
  return <iframe ref={frame} id="atlas-reviewer-frame" className="atlas-reviewer-frame" title="Reviewer sign-in and inbox" src={`${origin}/atlas/review/`} hidden={hidden} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" />;
}
