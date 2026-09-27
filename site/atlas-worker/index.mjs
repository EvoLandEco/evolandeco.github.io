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
    const current = path === "/current.json";
    if (!current && !/^\/releases\/[a-f0-9]{64}\/(atlas-site|map|metrics)\.json$/.test(path))
      return new Response("Not found", { status: 404, headers });
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return new Response("Forbidden", { status: 403, headers });
    if (!(await env.READ_LIMIT.limit({ key: ip })).success) {
      headers.set("Retry-After", "60");
      headers.set("Cache-Control", "no-store");
      return new Response("Too many requests", { status: 429, headers });
    }
    const key = path.slice(1) + (current ? "" : ".gz");
    const object = request.method === "HEAD"
      ? await env.ATLAS.head(key)
      : await env.ATLAS.get(key, { onlyIf: request.headers });
    if (!object) return new Response("Not found", { status: 404, headers });
    headers.set("Content-Type", "application/json; charset=utf-8");
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
