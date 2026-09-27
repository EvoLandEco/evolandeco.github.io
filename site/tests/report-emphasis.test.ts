import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportEmphasis } from '../src/lib/report-emphasis';

test('Report emphasis preserves dates, quantities and source wording', () => {
  const text = 'As of 23 September 2026, 7,890 cases and 3799 deaths (48.1%) were reported. From 23–25 Sept 2026: 5–10 cases, -2.5% and 1\u202f234 cases.';
  const tokens = reportEmphasis(text);
  assert.deepEqual(tokens.map(t => [t.text, t.kind]), [
    ['23 September 2026', 'date'], ['7,890', 'number'], ['3799', 'number'], ['48.1%', 'number'],
    ['23–25 Sept 2026', 'date'], ['5–10', 'number'], ['-2.5%', 'number'], ['1\u202f234', 'number'],
  ]);
  let end = 0, reconstructed = '';
  for (const token of tokens) { reconstructed += text.slice(end, token.index) + token.text; end = token.index + token.text.length; }
  assert.equal(reconstructed + text.slice(end), text);
  assert.deepEqual(reportEmphasis('September 23, 2026; 2026-09-23; 23/09/2026; May 2026.').map(t => t.text), ['September 23, 2026', '2026-09-23', '23/09/2026', 'May 2026']);
});

test('Disease identifiers, lineages and URLs are not quantities', () => {
  assert.deepEqual(reportEmphasis('H5N1, A(H9N2), COVID-19, clade B.1.1.7, mpox IIb, SARS-CoV-2. https://example.org/2026/09/23?q=42 www.example.org/123'), []);
  assert.deepEqual(reportEmphasis('The preceding 21 days; 63 health zones across seven provinces.').map(t => t.text), ['21', '63']);
  assert.deepEqual(reportEmphasis('An 11-year-old patient; a 14-day reporting period.').map(t => t.text), ['11', '14']);
});
