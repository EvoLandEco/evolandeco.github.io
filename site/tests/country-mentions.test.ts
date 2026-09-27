import test from "node:test";
import assert from "node:assert/strict";
import { countryMentions } from "../src/lib/country-mentions";

test("country names use complete, longest matches and preserve repeated mentions", () => {
  const text = "Democratic Republic of the Congo borders South Sudan. DRC and Sudan; Nigeria, Nigeria's reports. UK, Ukraine and US. Discuss with us; Nigerian reports.";
  const matches = countryMentions(text);
  assert.deepEqual(matches.map(m => m.code), ["CD", "SS", "CD", "SD", "NG", "NG", "GB", "UA", "US"]);
  for (const match of matches) assert.equal(text.slice(match.index, match.index + match.name.length), match.name);
  assert.deepEqual(countryMentions("Taiwan and Palestine").map(m => m.code), ["TW", "PS"]);
});

test("country mentions use canonical region codes for flag assets", () => {
  assert.deepEqual(countryMentions("France, Russia, Timor-Leste, Serbia, United Kingdom, Germany").map(m => m.code),
    ["FR", "RU", "TL", "RS", "GB", "DE"]);
});

test("EU and EEA reporting regions share one flag for each complete phrase", () => {
  const variants = ["EU/EEA", "EU / EEA", "EU–EEA", "EU-EEA", "EU & EEA", "EU and EEA", "EEA/EU", "European Union/European Economic Area", "European Union and European Economic Area", "European Union or European Economic Area", "EU/European Economic Area", "EU", "EEA", "European Union", "European Economic Area"];
  for (const name of variants) {
    const text = `Across ${name} countries.`;
    assert.deepEqual(countryMentions(text), [{ index: 7, name, code: "EU" }]);
  }
  assert.deepEqual(countryMentions("EURO, EEA1, EUIPO, ECDC and Europe."), []);
  assert.deepEqual(countryMentions("EU/EEA and France; Norway and Iceland.").map(m => m.code), ["EU", "FR", "NO", "IS"]);
});
