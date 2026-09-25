import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('Technical notes share the same content in the reader and static document', () => {
  for (const name of fs.readdirSync('content/writing')) {
    const article = fs.readFileSync(`content/writing/${name}`, 'utf8').trim();
    const document = fs.readFileSync(`public/reading/${name}`, 'utf8');
    assert.ok(document.includes(article), name);
    const ids = new Set([...article.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    for (const [, id] of article.matchAll(/href="#(ref\d+)"/g)) assert.ok(ids.has(id), `${name}: ${id}`);
  }
});

test('PDF tutorial uses physical dimensions and closes Chromium on failure', async () => {
  const article = fs.readFileSync('content/writing/convert-html-to-pdf-with-nodejs-and-puppeteer.html', 'utf8');
  const encoded = article.match(/<code class="javascript">(async function generatePDF[\s\S]*?)<\/code>/)![1];
  const source = encoded.replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
  let closed = false;
  let fail = false;
  let options: Record<string, unknown> = {};
  const context = vm.createContext({
    width: 8.27, height: 11.69,
    argv: { url: 'https://example.com', output: 'example.pdf', background: true, scale: 1, margin: true, top: 10, right: 10, bottom: 10, left: 10 },
    puppeteer: { launch: async () => ({
      newPage: async () => ({ goto: async () => {}, pdf: async (value: Record<string, unknown>) => { options = value; if (fail) throw new Error('Print failed'); } }),
      close: async () => { closed = true; },
    }) },
  });
  vm.runInContext(source.slice(0, source.indexOf('\ngeneratePDF().catch')), context);
  await vm.runInContext('generatePDF()', context);
  assert.equal(options.width, '8.27in');
  assert.equal(options.height, '11.69in');
  assert.equal((options.margin as Record<string, string>).top, '10mm');
  assert.ok(closed);
  closed = false;
  fail = true;
  await assert.rejects(vm.runInContext('generatePDF()', context), /Print failed/);
  assert.ok(closed);
});
