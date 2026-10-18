import type { DailyData as Daily022 } from "../0.2.2/daily";
export type PublicationVersion = { document_id: string; source_text_sha256: string; raw_sha256: string };
export type PublicationBinding = { document_versions: PublicationVersion[]; assertion_ids: string[]; comparison_ids: string[]; evidence_ids: string[]; reason: string; reviewed_at: string; reviewed_by: string };
export type DailyData = Omit<Daily022, "daily_version"> & { daily_version: "0.2.3"; publication_bindings: PublicationBinding[] };
