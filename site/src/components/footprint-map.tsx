"use client";

import { useEffect, useState } from "react";
import { DottedMap } from "@/components/magicui/dotted-map";
import type { PublicPhotography } from "../../scripts/photography-model";

export function FootprintMap({ countries }: { countries: PublicPhotography["countries"] }) {
  const [selected, setSelected] = useState("");
  const [hovered, setHovered] = useState("");
  useEffect(() => {
    const selectHash = () => setSelected(window.location.hash.replace(/^#map-/, ""));
    selectHash();
    window.addEventListener("hashchange", selectHash);
    return () => window.removeEventListener("hashchange", selectHash);
  }, []);
  const markers = countries.flatMap(country => {
    const point = country.mapMarker;
    if (!point) return [];
    return [{ ...point, ...country, size: .5 }];
  });
  return (
    <div className="footprint-atlas-panel" id="album-map">
      <div className="footprint-atlas">
        <DottedMap width={150} height={85} mapSamples={7000}
          stagger={false} pulse={false} dotColor="var(--atlas-dot)" dotRadius={.19}
          markerColor="var(--primary)" markers={markers}
          aria-label="World map of visited countries"
          renderMarkerOverlay={({ marker, x, y }) => (
            <a href={marker.albumHref ?? undefined} role={marker.albumHref ? undefined : "img"} tabIndex={0} data-pending={!marker.albumHref} id={`map-${marker.code}`} className="collection-pin" data-selected={selected === marker.code}
              aria-label={marker.albumHref ? `Open ${marker.name} album` : `${marker.name} · Visited`} onFocus={() => setSelected(marker.code)}
              onPointerEnter={() => setHovered(marker.code)} onPointerLeave={() => setHovered("")}>
              <title>{marker.name}</title>
              <circle className="atlas-pin-hit" cx={x} cy={y} r={1.8} />
              <circle className="atlas-pin-aura" cx={x} cy={y} r={1.8} />
              <circle className="atlas-pin-halo" cx={x} cy={y} r={1.15} />
              <circle className="atlas-pin-dot" cx={x} cy={y} r={.48} />
            </a>
          )}
          renderMarkerLabel={({ marker, x, y }) => {
            const label = marker.name;
            const width = label.length * 1.1 + 9;
            const left = Math.max(1, Math.min(x - width / 2, 149 - width));
            return <g className="atlas-pin-label" data-pending={!marker.albumHref} data-active={(hovered || selected) === marker.code} aria-hidden="true">
              <path className="atlas-label-stem" d={`M${x} ${y - 1.4}v-1.1`} />
              <rect className="country-label-bg" x={left} y={y - 8} width={width} height={5.5} rx={2.75} />
              <image href={`/flags/${marker.code.toLowerCase()}.webp`} x={left + 1.5} y={y - 6.6} width={3.3} height={2.5} preserveAspectRatio="xMidYMid meet" />
              <text className="country-label" x={left + 6} y={y - 5.2} dominantBaseline="central" fontSize={1.9}>{label}</text>
            </g>;
          }} />
      </div>
    </div>
  );
}
