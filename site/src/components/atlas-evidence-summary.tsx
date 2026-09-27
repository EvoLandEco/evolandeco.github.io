import { ChevronDown, FileText, MapPin, Quote, ScanLine } from "lucide-react";

const disclosures = {
  source: { label: "Source evidence", Icon: FileText },
  scope: { label: "Evidence & scope", Icon: ScanLine },
  location: { label: "Evidence & location detail", Icon: MapPin },
  quotation: { label: "Source quotation", Icon: Quote },
};

export function EvidenceSummary({ kind }: { kind: keyof typeof disclosures }) {
  const { label, Icon } = disclosures[kind];
  return <summary className="atlas-evidence-summary"><Icon size={15} aria-hidden /><span>{label}</span><ChevronDown className="atlas-evidence-chevron" size={16} aria-hidden /></summary>;
}
