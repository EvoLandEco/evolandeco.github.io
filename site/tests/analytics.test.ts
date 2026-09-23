import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("Analytics loads only on its configured hostname with SPA tracking", () => {
  const code = readFileSync("public/analytics.js", "utf8");
  for (const hostname of ["qtj.me", "localhost", "127.0.0.1", "preview.example.com"]) {
    const scripts: { src: string; type: string; dataset: { cfBeacon: string } }[] = [];
    runInNewContext(code, {
      location: { hostname },
      document: {
        currentScript: { dataset: { hostname: "qtj.me", token: "test-token" } },
        createElement: () => ({ dataset: {} }),
        body: { appendChild: (script: typeof scripts[number]) => scripts.push(script) },
      },
    });
    assert.equal(scripts.length, hostname === "qtj.me" ? 1 : 0);
    if (scripts.length) {
      assert.equal(scripts[0].src, "https://static.cloudflareinsights.com/beacon.min.js");
      assert.equal(scripts[0].type, "module");
      assert.deepEqual(JSON.parse(scripts[0].dataset.cfBeacon), { token: "test-token", spa: true });
    }
  }
});
