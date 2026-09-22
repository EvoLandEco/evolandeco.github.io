export const dynamic = "force-static";
export default function robots() {
  return {
    rules: {
      userAgent: "*",
      ...(process.env.SITE_INDEXABLE === "true"
        ? { allow: "/" }
        : { disallow: "/" }),
    },
    sitemap: `${process.env.SITE_ORIGIN || "https://qtj.me"}/sitemap.xml`,
  };
}
