export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import data from "@/content-data/portfolio.json";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.SITE_ORIGIN || data.profile.siteUrl;
  return [
    ...data.navigation.filter(n => !n.migrating).map((n) => n.path),
    ...data.projects.map((p) => p.primaryUrl),
  ].map((url) => ({ url: origin + url }));
}
