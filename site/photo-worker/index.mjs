const worker = {
  async fetch(request, env, ctx) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }
    const url = new URL(request.url);
    if (!/^\/(web|thumbnails)\/photo-[a-f0-9]{16}\.webp$/.test(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }
    const ip = request.headers.get("CF-Connecting-IP");
    if (!ip) return new Response("Forbidden", { status: 403 });
    const { success } = await env.PHOTO_RATE_LIMIT.limit({ key: ip });
    if (!success) return new Response("Too many image requests", {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
    const key = url.pathname.slice(1);
    const cacheKey = new Request(url.origin + url.pathname);
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      if (request.headers.get("If-None-Match") === cached.headers.get("ETag"))
        return new Response(null, { status: 304, headers: cached.headers });
      return request.method === "HEAD" ? new Response(null, cached) : cached;
    }
    const object = request.method === "HEAD" ? await env.PHOTOS.head(key) : await env.PHOTOS.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    const headers = new Headers({
      "Content-Type": "image/webp",
      "Content-Length": String(object.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "ETag": object.httpEtag,
      "X-Content-Type-Options": "nosniff",
    });
    if (request.headers.get("If-None-Match") === object.httpEtag)
      return new Response(null, { status: 304, headers });
    const response = new Response(request.method === "HEAD" ? null : object.body, { headers });
    if (request.method === "GET") ctx.waitUntil(caches.default.put(cacheKey, response.clone()));
    return response;
  },
};

export default worker;
