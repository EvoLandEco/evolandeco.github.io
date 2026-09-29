"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AtlasSelect } from "./atlas-select";

export function ReportPagination({ position, index, items, onChange, entity = "Report" }: {
  entity?: "Report" | "Geographic link" | "Assessment" | "Topic" | "One Health overview";
  position: "top" | "bottom"; index: number; items: { value: string; label: string }[]; onChange: (index: number) => void;
}) {
  return <nav className="atlas-pagination" aria-label={`${entity} pages, ${position}`}>
    <button aria-label={`Previous ${entity.toLowerCase()} page`} disabled={index === 0} onClick={() => onChange(index - 1)}><ChevronLeft size={16} aria-hidden /></button>
    <AtlasSelect label={`${entity} page, ${position}`} value={String(index)} items={items} onChange={value => onChange(Number(value))} />
    <button aria-label={`Next ${entity.toLowerCase()} page`} disabled={index === items.length - 1} onClick={() => onChange(index + 1)}><ChevronRight size={16} aria-hidden /></button>
  </nav>;
}

