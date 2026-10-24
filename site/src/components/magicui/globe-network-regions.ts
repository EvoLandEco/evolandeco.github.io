// Geographic membership: Unicode CLDR 48 territory containment, with Antarctica shown separately.
// https://github.com/unicode-org/cldr-json/blob/48.0.0/cldr-json/cldr-core/supplemental/territoryContainment.json
export const networkContinents = [
  { id: "002", name: "Africa", short: "Africa", color: "#8c8054", dark: "#c4b884", countries: "AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EA EG EH ER ET GA GH GM GN GQ GW IC IO KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RE RW SC SD SH SL SN SO SS ST SZ TD TF TG TN TZ UG YT ZA ZM ZW" },
  { id: "142", name: "Asia", short: "Asia", color: "#8773a4", dark: "#b5a1d2", countries: "AE AF AM AZ BD BH BN BT CN CY GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TR TW UZ VN YE" },
  { id: "150", name: "Europe", short: "Europe", color: "#547ca5", dark: "#89acd2", countries: "AD AL AT AX BA BE BG BY CH CQ CZ DE DK EE ES FI FO FR GB GG GI GR HR HU IE IM IS IT JE LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SJ SK SM UA VA XK" },
  { id: "003", name: "North America", short: "N. America", color: "#508d91", dark: "#80b9bd", countries: "AG AI AW BB BL BM BQ BS BZ CA CR CU CW DM DO GD GL GP GT HN HT JM KN KY LC MF MQ MS MX NI PA PM PR SV SX TC TT US VC VG VI" },
  { id: "005", name: "South America", short: "S. America", color: "#648f6d", dark: "#91bc99", countries: "AR BO BR BV CL CO EC FK GF GS GY PE PY SR UY VE" },
  { id: "009", name: "Oceania", short: "Oceania", color: "#a2776b", dark: "#cda397", countries: "AS AU CC CK CX FJ FM GU HM KI MH MP NC NF NR NU NZ PF PG PN PW SB TK TO TV UM VU WF WS" },
  { id: "AQ", name: "Antarctica", short: "Antarctica", color: "#7b8b9e", dark: "#a4b3c4", countries: "AQ" },
] as const;

export const countryContinent = new Map(networkContinents.flatMap(region => region.countries.split(" ").map(code => [code, region] as const)));
