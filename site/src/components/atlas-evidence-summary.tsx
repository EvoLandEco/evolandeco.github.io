import { ChevronDown, GitBranch, FileText, MapPin, Quote, ScanLine } from "lucide-react";

const disclosures = {
  source: { label: "Source evidence", Icon: FileText },
  scope: { label: "Evidence & scope", Icon: ScanLine },
  location: { label: "Evidence & location detail", Icon: MapPin },
  relationships: { label: "Relationships", Icon: GitBranch },
  quotation: { label: "Source quotation", Icon: Quote },
};

export function EvidenceSummary({ kind, count }: { kind: keyof typeof disclosures; count?: number }) {
  const { label, Icon } = disclosures[kind];
  return <summary className="atlas-evidence-summary"><Icon size={15} aria-hidden /><span>{label}</span>{count !== undefined && <span className="atlas-evidence-count">{count}</span>}<ChevronDown className="atlas-evidence-chevron" size={16} aria-hidden /></summary>;
}
