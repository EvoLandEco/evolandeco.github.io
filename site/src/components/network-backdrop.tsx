"use client";
import { useId, useRef } from "react";
import { usePanelMotion } from "./motion-policy";

export function NetworkBackdrop({ className = "" }: { className?: string }) {
  const id = useId();
  const element = useRef<SVGSVGElement>(null);
  const { playing } = usePanelMotion(element, true);
  const nodes = [[40,70],[130,125],[220,55],[310,145],[390,80],[485,125],[575,50],[675,155],[760,65],[875,130],[950,40],[110,260],[260,230],[440,265],[630,245],[825,270]];
  const edges = [[0,1],[1,2],[1,11],[2,3],[3,4],[3,12],[4,5],[5,6],[5,13],[6,7],[7,8],[7,14],[8,9],[9,10],[9,15],[11,12],[12,13],[13,14],[14,15]];
  return <svg ref={element} data-playing={playing} className={`network-backdrop ${className}`} aria-hidden="true" viewBox="0 0 1000 340" preserveAspectRatio="xMidYMin slice">
    <defs><pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="currentColor" opacity="0.3" /></pattern></defs>
    <rect width="1000" height="340" fill={`url(#${id})`} />
    <g className="network-edges">{edges.map(([a,b],i) => <path key={i} d={`M${nodes[a]} L${nodes[b]}`} />)}</g>
    {nodes.map(([cx,cy],i) => <circle key={i} className="network-node" cx={cx} cy={cy} r={i % 3 === 0 ? 3 : 2} style={{ animationDelay: `${i * -0.6}s` }} />)}
  </svg>;
}

