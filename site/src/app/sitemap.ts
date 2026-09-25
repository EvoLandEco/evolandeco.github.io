export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import notebook from "@/content-data/legacy.json";
import { albums } from "@/lib/photography";
import data from "@/content-data/portfolio.json";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = process.env.SITE_ORIGIN || data.profile.siteUrl;
  return [
    ...data.navigation.filter(n => !n.migrating).map((n) => n.path),
    ...data.projects.map((p) => p.primaryUrl),
    ...notebook.articles.map(({ slug }) => `/writing/${slug}`),
    ...notebook.tools.map(({ slug }) => `/blog/explore/${slug}`),
    ...albums.flatMap(album => [album.href, ...album.photos.map(photo => photo.href)]),
  ].map((url) => ({ url: origin + url }));
}
