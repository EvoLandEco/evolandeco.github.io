"use client";
import { AtlasRemote } from "@/components/atlas-remote";
import type { AtlasExperiment } from "@/lib/atlas-intelligence";

export function IntelligencePreview(experiment: AtlasExperiment) {
  return <AtlasRemote experiment={experiment} />;
}
