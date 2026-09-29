import { AtlasNetworkReview } from './atlas-network-review';
import type { AtlasRelease } from '@/lib/atlas-release';
import { useMemo } from 'react';
import { useAtlas } from './atlas-context';
import { AtlasScope } from './atlas-scope';
import { LocationSymbol } from './atlas-location-badges';
import { networkStatistics } from '@/lib/atlas-network-stats';
import type { AtlasLink } from '@/lib/atlas';

export function AtlasNetworkOverview({ links, onReport, release, recordIds }: { links: AtlasLink[]; onReport: (ids: string[]) => void; release: AtlasRelease; recordIds: ReadonlySet<string> }) {
  const { bundle, countriesForLink } = useAtlas();
  const areas = useMemo(() => new Map(bundle.areas.filter(area => area.code_system === 'ISO_3166_1_alpha_2').map(area => [area.code, area.label])), [bundle.areas]);
  const stats = useMemo(() => networkStatistics(links, new Set(areas.keys()), countriesForLink), [links, areas, countriesForLink]);
  const { hubs, corridors, destinations } = stats;
  const records = (entries: { records: Set<string> }[]) => [...new Set(entries.flatMap(entry => [...entry.records]))];
  const country = (code: string) => <span className="atlas-network-country" key={code} title={areas.get(code)}><LocationSymbol code={code} />{code}</span>;
  return <section className="atlas-network-overview" aria-label="Country network overview">

    <div className="atlas-network-stats">
      <button disabled={!hubs.length} onClick={() => onReport(records(hubs))} aria-label={`Most linked country: ${hubs.length ? hubs.map(node => `${areas.get(node.code)}, ${node.strength} links`).join("; ") : "no eligible links"}. View supporting reports`}>
        <span className="atlas-network-stat-label">Most linked country</span>
        <strong title={hubs.map(node => areas.get(node.code)).join(', ')}>{hubs.length ? <>{country(hubs[0].code)}{hubs.length > 1 && <small>+{hubs.length - 1} tied</small>}</> : '—'}</strong>
      </button>
      <button disabled={!corridors.length} onClick={() => onReport(records(corridors))} aria-label={`Most repeated pair: ${corridors.length ? corridors.map(pair => `${pair.codes.map(code => areas.get(code)).join(" and ")}, ${pair.weight} links`).join("; ") : "no eligible links"}. View supporting reports`}>
        <span className="atlas-network-stat-label">Most repeated pair</span>
        <strong title={corridors.map(pair => pair.codes.map(code => areas.get(code)).join(' ↔ ')).join('; ')}>{corridors.length ? <>{country(corridors[0].codes[0])}<span className="atlas-network-pair-arrow">↔</span>{country(corridors[0].codes[1])}{corridors.length > 1 && <small>+{corridors.length - 1} tied</small>}</> : '—'}</strong>
      </button>
      <div className="atlas-network-destination">
        <span className="atlas-network-stat-label">Top movement destination</span>
        <div className="atlas-network-destination-value">
          <button disabled={!destinations.length} onClick={() => onReport(records(destinations))} title="Country with the most incoming reported movement links in this selection; link counts do not measure case numbers or vulnerability." aria-label={`Top movement destination: ${destinations.length ? destinations.map(node => `${areas.get(node.code)}, ${node.weight} incoming reported movement links`).join("; ") : "no eligible directed movement links"}. View supporting reports`}>
            <strong title={destinations.map(node => areas.get(node.code)).join(', ')}>{destinations.length ? <>{country(destinations[0].code)}{destinations.length > 1 && <small>+{destinations.length - 1} tied</small>}</> : '—'}</strong>
          </button>
          <AtlasNetworkMethods links={links} release={release} recordIds={recordIds} />
        </div>
      </div>
    </div>
  </section>;
}

function AtlasNetworkMethods({ links, release, recordIds }: { links: AtlasLink[]; release: AtlasRelease; recordIds: ReadonlySet<string> }) {
  return <AtlasScope label="Network methods & references" title="Country network statistics">
      <div className="atlas-measure-details atlas-literature">
        <h3>Reporting counts · Unadjusted</h3>
        <p>These statistics describe links in the selected reports. They are not adjusted for surveillance, source coverage or collection differences, and do not estimate incidence, vulnerability or importation risk.</p>
        <dl>
          <div><dt>Most linked country</dt><dd>Highest incident link count, combining reported movement and shared events in both directions.</dd></div>
          <div><dt>Most repeated pair</dt><dd>Highest link count between two countries, combining both directions and both link types.</dd></div>
          <div><dt>Top movement destination</dt><dd>Highest incoming directed movement link count. Movement can describe people, goods or other transfers; shared events do not contribute.</dd></div>
          <div><dt>Counting unit</dt><dd>One per distinct exported link, not per case or supporting claim. Different links may describe the same episode.</dd></div>
        </dl>
        <p>Hypotheses, domestic links and ambiguous country endpoints are excluded. Rankings follow the globe’s reporting filters. Ties share the ranking; clicking a statistic opens evidence for every tied result.</p>
        <AtlasNetworkReview recordIds={recordIds} key={release.export_id} release={release} linkIds={links.map(link => link.id)} />
        <h3>Methods and interpretation</h3>
        <p>The connectivity measure uses weighted strength, as described by <a href="https://doi.org/10.1073/pnas.0400087101" target="_blank" rel="noopener noreferrer">Barrat et al. (2004)</a>. Studies of disease emergence model reporting effort explicitly: <a href="https://doi.org/10.1038/nature06536" target="_blank" rel="noopener noreferrer">Jones et al. (2008)</a> and <a href="https://doi.org/10.1038/s41467-017-00923-8" target="_blank" rel="noopener noreferrer">Allen et al. (2017)</a>. They motivate the need for bias analysis; their corrections have not been applied to these counts and do not validate these country rankings.</p>
        <h3>References</h3>
        <ol className="atlas-references">
          <li>Barrat A et al. (2004). <a href="https://doi.org/10.1073/pnas.0400087101" target="_blank" rel="noopener noreferrer">The architecture of complex weighted networks.</a> <i>PNAS</i> 101, 3747–3752.</li>
          <li>Jones KE et al. (2008). <a href="https://doi.org/10.1038/nature06536" target="_blank" rel="noopener noreferrer">Global trends in emerging infectious diseases.</a> <i>Nature</i> 451, 990–993.</li>
          <li>Allen T et al. (2017). <a href="https://doi.org/10.1038/s41467-017-00923-8" target="_blank" rel="noopener noreferrer">Global hotspots and correlates of emerging zoonotic diseases.</a> <i>Nature Communications</i> 8, 1124.</li>
        </ol>
      </div>
    </AtlasScope>;
}
