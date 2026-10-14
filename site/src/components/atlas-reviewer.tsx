"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { useTheme } from "next-themes";

const origin = "https://atlas-reviewer-inbox.evolandeco-github-io.workers.dev";

export function AtlasReviewer({ hidden, onReady, onClose }: { hidden: boolean; onReady: (ready: boolean) => void; onClose: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const signInWindow = useRef<Window | null>(null);
  const { resolvedTheme } = useTheme();
  const [signedIn, setSignedIn] = useState(false);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState(false);
  function signIn() {
    signInWindow.current?.close();
    signInWindow.current = window.open(`${origin}/atlas/review/sign-in`, "atlas-review-sign-in", "popup,width=480,height=640");
    setBlocked(!signInWindow.current);
  }
  const receive = useEffectEvent((event: MessageEvent) => {
    if (event.origin !== origin) return;
    if (signInWindow.current && event.source === signInWindow.current && event.data?.type === "atlas-review-signed-in") {
      signInWindow.current?.close();
      signInWindow.current = null;
      setSignedIn(true);
    }
    if (event.source === frame.current?.contentWindow && event.data?.type === "atlas-review-close") onClose();
    if (event.source === frame.current?.contentWindow && event.data?.type === "atlas-review-ready") {
      setReady(event.data.ready === true);
      onReady(event.data.ready === true);
      if (event.data.ready === false) setSignedIn(false);
    }
  });
  useEffect(() => {
    window.addEventListener("message", receive);
    return () => { window.removeEventListener("message", receive); signInWindow.current?.close(); };
  }, []);
  useEffect(() => {
    if (hidden) { signInWindow.current?.close(); signInWindow.current = null; }
  }, [hidden]);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: "atlas-review-theme", theme: resolvedTheme === "dark" ? "dark" : "light" }, origin);
  }, [ready, resolvedTheme]);
  return <div className="atlas-reviewer" hidden={hidden}>
    {signedIn ? <iframe ref={frame} id="atlas-reviewer-frame" className="atlas-reviewer-frame" title="Reviewer inbox" src={`${origin}/atlas/review/`} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" /> :
      <section className="atlas-reviewer-sign-in" aria-labelledby="atlas-reviewer-title">
        <h2 id="atlas-reviewer-title">Sign in to review</h2>
        <p>Use your reviewer email to sign in through Cloudflare. The inbox opens here after verification.</p>
        <button className="atlas-dataset-button" onClick={signIn}><ExternalLink size={16} aria-hidden /><span>Continue to sign-in</span></button>
        {blocked && <p role="alert">Allow the sign-in window in your browser, then try again.</p>}
      </section>}
  </div>;
}
