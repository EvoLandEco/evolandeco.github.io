const worker = {
  async fetch(request, env) {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "ETag",
      "X-Content-Type-Options": "nosniff",
    });
    if (request.method !== "GET" && request.method !== "HEAD") {
      headers.set("Allow", "GET, HEAD");
      return new Response("Method not allowed", { status: 405, headers });
    }
    const path = new URL(request.url).pathname;
    const current = path === "/current.json" || /^\/daily\/[a-f0-9]{64}\/current\.json$/.test(path);
    const dailyAsset = /^\/daily\/[a-f0-9]{64}\/[a-f0-9]{64}\/(?:(?:daily(?:\.schema)?|manifest|validation)\.json|daily-view\.mjs)$/.test(path);
    const releaseAsset = /^\/releases\/[a-f0-9]{64}\/(?:(?:atlas-site|map|metrics|network-transport|release)\.json|view\.mjs)$/.test(path);
    const networkAsset = /^\/network-analysis\/[a-f0-9]{64}\/(network-analysis|network-analysis\.schema|coverage-ledger)\.json$/.test(path);
    const intelligenceAsset = /^\/intelligence\/[a-f0-9]{64}\/(intelligence|contract\.schema)\.json$/.test(path);
    const browserAsset = /^\/releases\/[a-f0-9]{64}\/browser\/[a-f0-9]{64}\/(?:(?:manifest|release|core|map-core|detail-index|browser-transport\.schema|browser-manifest\.schema)\.json|(?:browser_transport|browser_tables|site_view)\.js|browser\.d\.mts|atlas\.d\.ts|details\/part-\d{5}\.json)$/.test(path);
    const supplementAsset = /^\/releases\/[a-f0-9]{64}\/supplements\/[a-f0-9]{64}\/source-supplement(?:\.schema)?\.json$/.test(path);
    const supplementCollectionAsset = /^\/releases\/[a-f0-9]{64}\/supplement-collections\/[a-f0-9]{64}\/source-supplement-(?:collection|catalogue)(?:\.schema)?\.json$/.test(path);
    const presentationAsset = /^\/releases\/[a-f0-9]{64}\/presentation\/[a-f0-9]{64}\/(?:source-text-display|watch)(?:\.schema)?\.json$/.test(path);
    if (!current && !dailyAsset && !releaseAsset && !networkAsset && !intelligenceAsset && !browserAsset && !supplementAsset && !supplementCollectionAsset && !presentationAsset)
      return new Response("Not found", { status: 404, headers });
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return new Response("Forbidden", { status: 403, headers });
    const limiter = browserAsset ? env.BROWSER_READ_LIMIT : env.READ_LIMIT;
    if (!(await limiter.limit({ key: ip })).success) {
      headers.set("Retry-After", "60");
      headers.set("Cache-Control", "no-store");
      return new Response("Too many requests", { status: 429, headers });
    }
    const key = path.slice(1) + (current ? "" : ".gz");
    const object = request.method === "HEAD"
      ? await env.ATLAS.head(key)
      : await env.ATLAS.get(key, { onlyIf: request.headers });
    if (!object) return new Response("Not found", { status: 404, headers });
    headers.set("Content-Type", /\.(?:mjs|js)$/.test(path) ? "text/javascript; charset=utf-8" : /\.d\.(?:mts|ts)$/.test(path) ? "text/plain; charset=utf-8" : "application/json; charset=utf-8");
    headers.set("Cache-Control", current ? "public, max-age=60, must-revalidate" : "public, max-age=31536000, immutable");
    headers.set("ETag", object.httpEtag);
    if (!current) headers.set("Content-Encoding", "gzip");
    if (request.headers.get("If-None-Match")?.split(",").some(tag => tag.trim() === "*" || tag.trim().replace(/^W\//, "") === object.httpEtag))
      return new Response(null, { status: 304, headers });
    if (request.method === "GET" && !("body" in object))
      return new Response(null, { status: 412, headers });
    headers.set("Content-Length", String(object.size));
    return new Response(request.method === "HEAD" ? null : object.body, { headers, encodeBody: "manual" });
  },
};

export default worker;
