import { notFound } from "next/navigation";
import Image from "next/image";
import { albums, isSample } from "@/lib/photography";
export function generateStaticParams() {
  return albums.flatMap((a) =>
    a.photos.map((p) => ({ country: a.countrySlug, photo: p.id })),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ country: string; photo: string }>;
}) {
  const { country, photo } = await params,
    a = albums.find((a) => a.countrySlug === country),
    p = a?.photos.find((p) => p.id === photo);
  return {
    title: p?.caption || a?.title,
    alternates: { canonical: p?.href },
    ...(a && isSample(a) ? { robots: { index: false, follow: true } } : {}),
  };
}
export default async function Photo({
  params,
}: {
  params: Promise<{ country: string; photo: string }>;
}) {
  const { country, photo } = await params,
    a = albums.find((a) => a.countrySlug === country),
    p = a?.photos.find((p) => p.id === photo);
  if (!a || !p) notFound();
  const i = a.photos.indexOf(p);
  return (
    <section className="surface">
      <a className="text-link" href={a.href}>
        ← {a.title}
      </a>
      <h1 style={{ fontSize: 26, marginTop: 24 }}>{p.caption || a.title}</h1>
      <Image
        className="full-photo"
        src={p.image.src}
        width={p.image.width}
        height={p.image.height}
        sizes="90vw"
        alt={p.alt}
        priority
      />
      <p className="caption" style={{ marginTop: 15 }}>
        Photograph: {p.creator}
        {isSample(a) ? " · Sample image" : ""}
        {p.takenOn && ` · ${p.takenOn}`}
        {p.locationLabel && ` · ${p.locationLabel}`}
      </p>
      <div className="actions">
        {i > 0 && (
          <a className="button" href={a.photos[i - 1].href}>
            ← Previous photo
          </a>
        )}
        {i < a.photos.length - 1 && (
          <a className="button" href={a.photos[i + 1].href}>
            Next photo →
          </a>
        )}
      </div>
    </section>
  );
}
