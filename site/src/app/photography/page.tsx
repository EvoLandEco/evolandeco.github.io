import { Lens } from "@/components/magicui/lens";
import { AuroraText } from "@/components/magicui/aurora-text";
import { AlbumSearch } from "@/components/album-search";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { MagicCard } from "@/components/magicui/magic-card";
import { SectionHeading } from "@/components/portfolio-sections";
import { FootprintMap } from "@/components/footprint-map";
import { photography } from "@/lib/photography";
export const metadata = {
  title: "Footprint",
  description:
    "Places I’ve been, collected through photographs.",
  alternates: { canonical: "/photography" },
};
export default function Footprint() {
  const p = photography;
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
          <FootprintMap countries={p.countries} />
        </div>
      </section>
      <section className="surface" id="collections">
        <SectionHeading label="Footprint" title="Country albums" />
        <AlbumSearch />
        <div className="photo-grid">
          {p.albums.map((a) => (
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
                    src={a.cover.image.thumbnail?.src ?? a.cover.image.src}
                    alt={a.cover.alt}
                    width={a.cover.image.width}
                    height={a.cover.image.height}
                    sizes="(max-width:639px) 90vw, 380px"
                  /></Lens>
                </div>
                  <div className="album-caption">
                    <div><h3>{a.title}</h3><p className="caption">{a.photos.length} {a.photos.length === 1 ? "photograph" : "photographs"}</p></div>
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
