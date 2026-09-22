"use client";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
export function CopyCitation({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  return (
    <>
      <button
        className="paper-action"
        onClick={async () => {
          try {
            const response = await fetch(`/citations/${id}.bib`);
            if (!response.ok) throw new Error("Citation unavailable");
            await navigator.clipboard.writeText(await response.text());
            setMessage("Citation copied");
          } catch {
            setMessage("Copy unavailable. Download the BibTeX file instead.");
          }
        }}
      >
        Copy citation
        {message === "Citation copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      </button>
      <span role="status" className="sr-only">
        {" "}
        {message}
      </span>
    </>
  );
}
