const names = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
const countries = new Map<string, string>();
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = new Intl.Locale(`und-${String.fromCharCode(a, b)}`).region!;
  const name = names.of(code);
  if (name) countries.set(name, code);
}
for (const [code, aliases] of Object.entries({
  CD: ["Democratic Republic of the Congo", "Democratic Republic of Congo", "DR Congo", "DRC"],
  CG: ["Republic of the Congo", "Republic of Congo"],
  GB: ["United Kingdom", "UK"], US: ["United States of America", "United States", "USA", "US"],
  KR: ["Republic of Korea"], KP: ["Democratic People's Republic of Korea"],
  TZ: ["United Republic of Tanzania"], IR: ["Islamic Republic of Iran"],
  VN: ["Viet Nam"], LA: ["Lao People's Democratic Republic", "Lao PDR"],
  CZ: ["Czech Republic"], TR: ["Türkiye"], CI: ["Cote d'Ivoire", "Côte d'Ivoire"],
  SZ: ["Swaziland"], CV: ["Cabo Verde"], TL: ["East Timor"],
  PS: ["Palestine", "State of Palestine"],
})) for (const alias of aliases) countries.set(alias, code);

const eu = "(?:EU|European Union)", eea = "(?:EEA|European Economic Area)";
const europeanRegion = `(?:${eu}\\s*(?:[/&–—-]|and|or)\\s*${eea}|${eea}\\s*(?:[/&–—-]|and|or)\\s*${eu}|${eea}|${eu})`;
const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:(?<europe>${europeanRegion})|${[...countries.keys()].sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}_])`, "gu");

export function countryMentions(text: string) {
  return [...text.matchAll(pattern)].map(match => ({ index: match.index, name: match[0], code: match.groups?.europe ? "EU" : countries.get(match[0])! }));
}
