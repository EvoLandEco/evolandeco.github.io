import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { AtlasDetailLease, AtlasDetailRef } from "@/lib/atlas-browser";
import { useAtlas } from "./atlas-context";

export function useAtlasDetails(request: readonly AtlasDetailRef[]) {
  const { details } = useAtlas();
  const key = JSON.stringify(request);
  const refs = useMemo(() => JSON.parse(key) as AtlasDetailRef[], [key]);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; attempt: number; store: typeof details; signal: AbortSignal; data?: AtlasDetailLease; error?: Error }>();
  useEffect(() => {
    const controller = new AbortController();
    let lease: AtlasDetailLease | undefined;
    details.acquire(refs, controller.signal).then(data => {
      if (controller.signal.aborted) { data.release(); return; }
      lease = data;
      setResult({ key, attempt, store: details, signal: controller.signal, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ key, attempt, store: details, signal: controller.signal, error: error instanceof Error ? error : new Error("Source details could not be loaded") });
    });
    return () => { controller.abort(); lease?.release(); };
  }, [details, refs, key, attempt]);
  const current = result?.key === key && result.attempt === attempt && result.store === details && !result.signal.aborted ? result : undefined;
  return { data: current?.data, error: current?.error, retry: () => setAttempt(value => value + 1) };
}

export function AtlasDetailStatus({ error, retry }: { error?: Error; retry: () => void }) {
  return error ? <div className="atlas-load-status" role="alert"><span>Source details could not be verified.</span><button onClick={retry}><RefreshCw size={14} aria-hidden />Try again</button></div>
    : <p className="atlas-empty" role="status">Loading source details…</p>;
}
