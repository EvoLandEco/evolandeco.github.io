import Image from "next/image";
import { MapPin } from "lucide-react";
import { createContext, useContext, Fragment } from "react";
import { reportEmphasis } from "@/lib/report-emphasis";
import { countryMentions } from "@/lib/country-mentions";

export const ReportCountryFlags = createContext(false);

export function CountryText({ children: text }: { children: string | null | undefined }) {
  const enabled = useContext(ReportCountryFlags);
  if (!enabled || !text) return text;
  const mentions = countryMentions(text);
  const parts = mentions.map(({ index, name, code }, i) => {
    const previous = mentions[i - 1];
    const before = text.slice(previous ? previous.index + previous.name.length : 0, index);
    return <Fragment key={index}><ReportEmphasis text={before} /><span className="atlas-country-inline" aria-hidden><LocationSymbol code={code} /></span>{"\u00a0"}{name}</Fragment>;
  });
  const last = mentions.at(-1);
  return <>{parts}<ReportEmphasis text={text.slice(last ? last.index + last.name.length : 0)} /></>;
}

function ReportEmphasis({ text }: { text: string }) {
  const tokens = reportEmphasis(text);
  const parts = tokens.map((token, index) => {
    const previous = tokens[index - 1];
    const before = text.slice(previous ? previous.index + previous.text.length : 0, token.index);
    return <Fragment key={token.index}>{before}<mark className={`atlas-report-inline-${token.kind}`}>{token.text}</mark></Fragment>;
  });
  const last = tokens.at(-1);
  return <>{parts}{text.slice(last ? last.index + last.text.length : 0)}</>;
}

const neutralLocations = new Set(["TW", "PS", "XK", "EH", "FK", "GS", "AQ"]);

export function LocationSymbol({ code }: { code: string }) {
  return neutralLocations.has(code)
    ? <MapPin size={14} aria-hidden />
    : <Image className="atlas-location-flag" src={`https://flagcdn.com/w40/${code.toLowerCase()}.webp`} width={20} height={15} alt="" />;
}

export function LocationBadges({ codes }: { codes: string[] }) {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return <span className="atlas-location-badges" role="group" aria-label="Locations">{codes.map(code => <span className="atlas-location-badge" role="img" key={code} title={names.of(code)} aria-label={names.of(code)}><LocationSymbol code={code} /><span aria-hidden>{code}</span></span>)}</span>;
}
