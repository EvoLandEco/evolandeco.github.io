import { Lens } from "@/components/magicui/lens";
import { AuroraText } from "@/components/magicui/aurora-text";
import { AlbumSearch } from "@/components/album-search";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { MagicCard } from "@/components/magicui/magic-card";
import { SectionHeading } from "@/components/portfolio-sections";
import { DottedMap } from "@/components/magicui/dotted-map";
import { photography, sampleAlbums } from "@/lib/photography";
export const metadata = {
  title: "Footprint",
  description:
    "Places I’ve been, collected through photographs. A preview with sample images.",
  alternates: { canonical: "/photography" },
};
export default function Footprint() {
  const p = photography;
  const markers = [
    ...p.countries.flatMap(c => c.mapMarker ? [{ ...c.mapMarker, size: .65, pulse: false, href: c.albumHref, label: c.name, countryName: c.name, flag: c.code.toLowerCase() }] : []),
    ...sampleAlbums.map(album => ({ ...album.sampleLocation, countryName: album.title, size: .65, pulse: false, href: album.href, label: `${album.title} · sample collection` })),
  ];
  return (
    <>
      <section className="surface">
        <h1 className="sr-only">Footprint</h1>
        <div
          className="map footprint-map"
          data-testid="signature-dotted-map"
          data-motion-state="static"
        >
          <p className="visual-intro"><AuroraText colors={["var(--primary)", "#398775", "var(--primary)"]}>Places explored. Moments collected.</AuroraText></p>
          <div className="footprint-atlas">
          <DottedMap
            width={150}
            height={75}
            mapSamples={5000}
            stagger={false}
            pulse={false}
            dotColor="var(--atlas-dot)"
            dotRadius={0.23}
            markerColor="var(--primary)"
            markers={markers}
            aria-label="Collection map with sample locations"
            renderMarkerOverlay={({ marker, x, y, index }) => {
              if (!marker.href) return null;
              const pillWidth = marker.countryName.length * 1.2 + 4;
              const pillX = x > 110 ? x - pillWidth - 3 : x + 3;
              const clipId = `country-flag-${index}`;
              return <a href={marker.href} className="collection-pin" aria-label={marker.label}>
                <title>{marker.label}</title>
                <circle cx={x} cy={y} r={5} fill="transparent" />
                <g className="country-marker" style={{ transformOrigin: `${x}px ${y}px` }}>
                  <circle className="flag-ring" cx={x} cy={y} r={2.7} />
                  <clipPath id={clipId}><circle cx={x} cy={y} r={2.1} /></clipPath>
                  <image href={`https://flagcdn.com/w80/${marker.flag}.webp`} x={x - 2.1} y={y - 2.1} width={4.2} height={4.2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
                  <rect className="country-label-bg" x={pillX} y={y - 2.6} width={pillWidth} height={5.2} rx={2.6} />
                  <text className="country-label" x={pillX + pillWidth / 2} y={y} textAnchor="middle" dominantBaseline="central" fontSize={2}>{marker.countryName}</text>
                </g>
              </a>;
            }}
          />
          </div>
        </div>
        {p.summary.countryCount !== null && (
          <p data-testid="travel-count" data-count={p.summary.countryCount}>
            {p.summary.countryCount} {p.summary.countryLabel}
          </p>
        )}
        {p.countries.length > 0 && (
          <div className="link-list" data-testid="country-list">
            {p.countries.map((c) => (
              <p key={c.code} data-country-code={c.code}>
                {c.albumHref ? (
                  <a href={c.albumHref}>{c.name} ↗</a>
                ) : (
                  `${c.name} · Album not published`
                )}
              </p>
            ))}
          </div>
        )}
        {p.albums.length > 0 && (
          <p className="caption">
            {p.summary.albumCount} albums · {p.summary.photoCount} photographs
          </p>
        )}
      </section>
      <section className="surface" id="collections">
        <SectionHeading label={p.albums.length ? "Footprint" : "Sample collection"}
          title={p.albums.length ? "Country albums" : "A glimpse of the gallery"} />
        <AlbumSearch />
        <div className="photo-grid">
          {[...p.albums, ...sampleAlbums].map((a) => (
            <a
              className="album-card"
              key={a.id}
              href={a.href}
              data-album-id={a.id}
              data-album-title={a.title}
            >
              <MagicCard className="album-magic" gradientFrom="#719ddd" gradientTo="#80b9a8" gradientColor="#83b7df" gradientOpacity={0.14} gradientSize={280}>
                <div className="album-visual">
                  <Lens><Image
                    src={a.cover.image.src}
                    alt={a.cover.alt}
                    width={a.cover.image.width}
                    height={a.cover.image.height}
                    sizes="(max-width:639px) 90vw, 380px"
                  /></Lens>
                </div>
                  <div className="album-caption">
                    <h3>{a.title}</h3>
                    <span className="album-open">Let’s go <ArrowUpRight size={18} aria-hidden /></span>
                  </div>
              </MagicCard>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
