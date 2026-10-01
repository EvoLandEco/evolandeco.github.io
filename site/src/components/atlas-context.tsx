"use client";
import { createContext, useContext, useLayoutEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AtlasStore } from "@/lib/atlas-store";

export const AtlasWorkspaceContext = createContext(false);

export const AtlasContext = createContext<AtlasStore | null>(null);
export function useAtlas() {
  const atlas = useContext(AtlasContext);
  if (!atlas) throw new Error("ATLAS data provider is missing");
  return atlas;
}

export const AtlasPanelStateContext = createContext<Map<string, unknown> | null>(null);

export function useAtlasPanelState<T>(key: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const memory = useContext(AtlasPanelStateContext);
  if (!memory) throw new Error("ATLAS panel state provider is missing");
  const read = () => memory.has(key) ? memory.get(key) as T : typeof initial === "function" ? (initial as () => T)() : initial;
  const [value, setValue] = useState<T>(read);
  const [previousKey, setPreviousKey] = useState(key);
  if (previousKey !== key) {
    setPreviousKey(key);
    setValue(read());
  }
  useLayoutEffect(() => { memory.set(key, value); }, [memory, key, value]);
  return [value, setValue];
}
