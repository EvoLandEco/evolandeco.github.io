"use client";
import { memo, useEffect, useRef, useState } from "react";
import { Activity, FileText, RefreshCw } from "lucide-react";
import { createAtlasStore, type AtlasStore } from "@/lib/atlas-store";
import { fetchAtlasData, releaseRoot, type AtlasRelease, type AtlasLoadProgress } from "@/lib/atlas-release";
import { AtlasContext } from "./atlas-context";
import { AtlasExplorer } from "./atlas-explorer";
import { Globe } from "./magicui/globe";
import { AuroraText } from "./magicui/aurora-text";
import { usePanelMotion } from "./motion-policy";
import { useAtlasNavigation } from "./atlas-navigation";

const LoadingGlobe = memo(Globe);

export function AtlasRemote() {
  const { arriving } = useAtlasNavigation();
  const [data, setData] = useState<{ store: AtlasStore; root: string; release: AtlasRelease }>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState<AtlasLoadProgress>({ phase: "release", loaded: 0, total: 0 });
  const panel = useRef<HTMLDivElement>(null);
  const motion = usePanelMotion(panel, true);
  useEffect(() => {
    if (arriving) return;
    const controller = new AbortController();
    fetchAtlasData(controller.signal, value => { if (!controller.signal.aborted) setProgress(value); }).then(({ snapshot, bundle, release }) => {
      if (!controller.signal.aborted) setData({ store: createAtlasStore(snapshot, bundle), root: releaseRoot(release), release });
    }).catch(() => { if (!controller.signal.aborted) { controller.abort(); setError(true); } });
    return () => controller.abort();
  }, [attempt, arriving]);
  if (data) return <AtlasContext value={data.store}><AtlasExplorer downloadRoot={data.root} release={data.release} /></AtlasContext>;
  const percent = progress.total ? Math.floor(progress.loaded / progress.total * 100) : 0;
  const phase = { release: "Checking the latest release…", download: "Downloading reports and map…", verify: "Checking downloaded data…", prepare: "Preparing reports and source evidence…" }[progress.phase];
  return <div className="atlas-page atlas-loading" data-ready="false">
    <header className="atlas-heading">
      <div><p className="atlas-eyebrow"><Activity size={14} aria-hidden />Outbreak intelligence</p><h1><AuroraText colors={["var(--primary)", "#639b91", "var(--foreground)"]} speed={0.45}>ATLAS</AuroraText></h1></div>
      <p>Follow the reports.<br /><span>Explore the connections.</span></p>
    </header>
    <section ref={panel} className="atlas-observatory" aria-label="Loading ATLAS">
      <div className="atlas-globe-frame globe-frame"><LoadingGlobe playing={motion.playing} visible={motion.visible || arriving} /></div>
      {error ? <div className="atlas-load-status" role="alert"><span>Reports could not be loaded.</span><button onClick={() => { setError(false); setAttempt(n => n + 1); }}><RefreshCw size={14} aria-hidden />Try again</button></div>
        : <div className="atlas-panel-loading"><div className="atlas-panel-loading-content"><span className="atlas-panel-loading-mark" aria-hidden><FileText size={30} strokeWidth={1.5} /></span><strong>Loading reports</strong><span className="atlas-loading-phase" role="status">{phase}</span><div className="atlas-load-progress">
          <progress aria-label="Reports download" max={progress.total || 1} value={progress.total ? progress.loaded : undefined} />
          <div aria-hidden="true"><span>{progress.total ? `${(progress.loaded / 1e6).toFixed(1)} / ${(progress.total / 1e6).toFixed(1)} MB` : "Connecting"}</span><b>{progress.total ? `${percent}%` : "—"}</b></div>
        </div></div></div>}
    </section>
  </div>;
}
