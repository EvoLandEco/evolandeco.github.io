"use client";
import { createContext, useContext } from "react";
import type { AtlasStore } from "@/lib/atlas-store";

export const AtlasWorkspaceContext = createContext(false);

export const AtlasContext = createContext<AtlasStore | null>(null);
export function useAtlas() {
  const atlas = useContext(AtlasContext);
  if (!atlas) throw new Error("ATLAS data provider is missing");
  return atlas;
}
