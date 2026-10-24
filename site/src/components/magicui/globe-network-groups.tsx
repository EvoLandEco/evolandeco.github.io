import { useImperativeHandle, useMemo, useRef, useState, type CSSProperties, type Ref } from "react";
import { Layers3 } from "lucide-react";
import { geographicEnvelope, geographicGroups } from "./globe-network-geography";
import { countryContinent, networkContinents } from "./globe-network-regions";
import type { GlobeNode } from "./globe";
import type { NetworkPoint } from "./globe-network";

export type GeographyPaint = { paint: (points: (NetworkPoint | null)[], mix: number) => void };
const palette = (region: typeof networkContinents[number]) => ({ "--geo-light": region.color, "--geo-dark": region.dark }) as CSSProperties;

export function GlobeNetworkGroups({ nodes, componentOf, isolated, activeCountries, enabled, regions, onRegionsChange, ref }: {
  nodes: GlobeNode[]; componentOf: ReadonlyMap<string, number>; isolated: ReadonlySet<string>; activeCountries: string[]; enabled: boolean; ref: Ref<GeographyPaint>;
  regions: string[]; onRegionsChange: (regions: string[]) => void;
}) {
  const groups = useMemo(() => geographicGroups(nodes, componentOf), [nodes, componentOf]);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [focusedRegion, setFocusedRegion] = useState<string | null>(null);
  const shapes = useRef<(SVGPathElement | null)[]>([]), rings = useRef<(SVGGElement | null)[]>([]);
  const continentShapes = useRef<(SVGPathElement | null)[]>([]);
  const layer = useRef<HTMLDivElement>(null);
  const continents = networkContinents.filter(region => [...groups.countries.keys()].some(code => countryContinent.get(code)?.id === region.id));
  const selectedRegions = enabled ? regions.filter(id => continents.some(item => item.id === id)) : [];
  const previewRegion = enabled ? hoveredRegion ?? focusedRegion : null;
  const highlightedRegions = previewRegion ? [...selectedRegions, previewRegion] : selectedRegions;
  const focusedCountries = previewRegion ? [] : activeCountries.filter(code => groups.countries.has(code));
  const focus = (code: string) => focusedCountries.length ? focusedCountries.includes(code) : highlightedRegions.includes(countryContinent.get(code)!.id);
  const inspecting = !!(focusedCountries.length || highlightedRegions.length);
  useImperativeHandle(ref, () => ({ paint(points, mix) {
    if (layer.current) layer.current.style.opacity = String(mix * mix);
    if (!mix) return;
    const pixels = points.map(point => point && ({ x: 500 + point.x * 480, y: 500 - point.y * 480 }));
    groups.envelopes.forEach((group, i) => {
      if (group.members.length < 2) return;
      const members = group.members.map(index => pixels[index]).filter((point): point is NetworkPoint => !!point);
      shapes.current[i]?.setAttribute("d", geographicEnvelope(members, 18));
    });
    groups.continents.forEach((group, i) => {
      if (group.members.length < 2) return;
      const members = group.members.map(index => pixels[index]).filter((point): point is NetworkPoint => !!point);
      continentShapes.current[i]?.setAttribute("d", geographicEnvelope(members, 27));
    });
    pixels.forEach((point, i) => {
      if (point) rings.current[i]?.setAttribute("transform", `translate(${point.x},${point.y})`);
      const visibility = point ? "visible" : "hidden";
      if (rings.current[i]?.getAttribute("visibility") !== visibility) rings.current[i]?.setAttribute("visibility", visibility);
    });
  } }), [groups]);
  return <div ref={layer} className="globe-network-geography" data-enabled={enabled} data-inspecting={inspecting}>
    <svg className="globe-geography-envelopes" viewBox="0 0 1000 1000" aria-hidden="true">
      {groups.continents.map((group, i) => <path key={group.id} ref={el => { continentShapes.current[i] = el; }}
        d={group.members.length < 2 ? "" : undefined}
        className="globe-continent-envelope" data-region={group.region} data-active={!focusedCountries.length && highlightedRegions.includes(group.region)}
        style={palette(networkContinents.find(region => region.id === group.region)!)} />)}
      {groups.envelopes.map((group, i) => <path key={group.id} ref={el => { shapes.current[i] = el; }}
        d={group.members.length < 2 ? "" : undefined}
        className="globe-country-envelope" data-country={group.code} data-active={focus(group.code)}
        style={palette(countryContinent.get(group.code)!)} />)}
      {nodes.map((node, i) => {
        const codes = [...new Set(node.countries)].filter(code => groups.countries.has(code));
        const regions = [...new Set(codes.map(code => countryContinent.get(code)!))];
        return <g key={node.id} ref={el => { rings.current[i] = el; }} className="globe-geography-member" data-active={regions.some(region => highlightedRegions.includes(region.id))} data-countries={codes.join(" ")}>
          {regions.map((region, j) => <circle key={region.id} r={isolated.has(node.location.join(",")) ? 7 : 12} pathLength="1" fill="none" style={palette(region)}
            strokeDasharray={regions.length > 1 ? `${1 / regions.length - .035} 1` : undefined} strokeDashoffset={-j / regions.length} />)}
        </g>;
      })}
    </svg>
    <div className="globe-geography-controls" inert={!enabled} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}
      onKeyDown={event => { if (event.key === "Escape" && (selectedRegions.length || previewRegion)) {
        event.preventDefault(); event.stopPropagation(); onRegionsChange([]); setHoveredRegion(null); setFocusedRegion(null);
      } }}>
      {continents.length > 0 && <div className="globe-continent-key" role="group" aria-label="Highlight geographic groups">
        <Layers3 size={13} aria-hidden="true" />
        {continents.map(item => <button key={item.id} style={palette(item)} aria-label={`Highlight ${item.name}`} aria-pressed={selectedRegions.includes(item.id)}
          onPointerEnter={event => { if (event.pointerType !== "touch") setHoveredRegion(item.id); }} onPointerLeave={() => setHoveredRegion(null)} onPointerCancel={() => setHoveredRegion(null)}
          onPointerDown={() => setFocusedRegion(null)}
          onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setFocusedRegion(item.id); }} onBlur={() => setFocusedRegion(null)}
          onClick={() => onRegionsChange(regions.includes(item.id) ? regions.filter(id => id !== item.id) : [...regions, item.id])}>
          <span aria-hidden="true" />{item.short}
        </button>)}
      </div>}
    </div>
  </div>;
}
