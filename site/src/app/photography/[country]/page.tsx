import Link from "next/link";
import { notFound } from "next/navigation";
import { albums } from "@/lib/photography";
import { PhotoGallery } from "@/components/photo-gallery";
export function generateStaticParams() {
  return albums.map((a) => ({ country: a.countrySlug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params,
    a = albums.find((a) => a.countrySlug === country);
  return {
    title: a?.title,
    description: a?.description,
    alternates: { canonical: `/photography/${country}` },
  };
}
export default async function Album({
  params,
}: {
  params: Promise<{ country: string }>;
}) {
  const { country } = await params,
    a = albums.find((a) => a.countrySlug === country);
  if (!a) notFound();
  return (
    <section className="surface">
      <Link className="text-link" href={`/photography#map-${a.countryCode}`}>
        ← Back to the map
      </Link>
      <header className="page-head" style={{ marginTop: 24 }}>
        <p className="eyebrow">
          Country album
        </p>
        <h1>{a.title}</h1>
        <p>{a.description}</p>
        <p className="caption">{a.photos.length} {a.photos.length === 1 ? "photograph" : "photographs"}</p>
      </header>
      <PhotoGallery album={a} />
    </section>
  );
}
