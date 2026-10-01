import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { intelligenceSchema, type IntelligenceExperiment } from "@/lib/atlas-intelligence";
import { IntelligencePreview } from "./preview";

export const metadata = {
  title: "ATLAS Intelligence · Experiment",
  robots: { index: false, follow: false },
};

export default async function IntelligencePage() {
  if (process.env.NODE_ENV !== "development" || process.env.ATLAS_INTELLIGENCE_PREVIEW !== "1") notFound();
  const path = process.env.ATLAS_INTELLIGENCE_FILE;
  if (!path) return <IntelligencePreview />;
  let data: IntelligenceExperiment | undefined, digest: string | undefined, error: string | undefined;
  try {
    const bytes = await readFile(path);
    digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== process.env.ATLAS_INTELLIGENCE_SHA256) error = "The experiment file does not match its configured SHA-256 checksum.";
    else data = intelligenceSchema.parse(JSON.parse(bytes.toString("utf8")));
  } catch {
    error = "The experiment could not be read or did not match the ATLAS Intelligence 0.2.0 contract.";
  }
  return <IntelligencePreview data={data} digest={digest} error={error} />;
}
