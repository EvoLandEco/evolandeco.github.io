import { useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, FileText, Globe2, Layers3, Search, Waypoints } from 'lucide-react';
import { formatDate, type AtlasLink, type AtlasRecord, type DateBasis } from '@/lib/atlas';
import { networkSummary, networkLayers, type NetworkLayer } from '@/lib/atlas-network-summary';
import type { AtlasRelease } from '@/lib/atlas-release';
import { useAtlas } from './atlas-context';
import { AtlasSelect } from './atlas-select';
import { AtlasScope } from './atlas-scope';
import { AtlasNetworkReview } from './atlas-network-review';
import { MetricFigures } from './atlas-metrics';
import { LocationSymbol } from './atlas-location-badges';
import { networkContinents } from './magicui/globe-network-regions';
import styles from './atlas-network-panel.module.css';

type Props = { links: AtlasLink[]; rows: AtlasRecord[]; layer: NetworkLayer; release: AtlasRelease;
  basis: DateBasis; window: readonly [string, string]; includeContext: boolean; onReport: (ids: string[]) => void };

export function AtlasNetworkPanel({ links, rows, layer, release, basis, window, includeContext, onReport }: Props) {
  const { bundle, countriesForLink, selectedResearch, lookup, sourceName } = useAtlas();
  const recordIds = useMemo(() => new Set(rows.map(row => row.id)), [rows]);
  const stats = useMemo(() => networkSummary({ links, rows, bundle, layer, countriesForLink, basis, window, includeContext,
    membershipIds: new Set(selectedResearch(recordIds).location_membership_ids),
  }), [links, rows, bundle, layer, countriesForLink, basis, window, includeContext, selectedResearch, recordIds]);
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState<{ label: string; ids: string[] } | null>(null);
  const evidenceRef = useRef<HTMLElement>(null);
  const directed = layer === 'movement_directed';
  const arrow = directed ? '→' : '—';
  const regions: { id: string; name: string; short: string }[] = [...networkContinents,
    ...(stats.cells.some(cell => cell.regions.includes('unmapped')) ? [{ id: 'unmapped', name: 'Continent unassigned', short: 'Unassigned' }] : [])];
  const maxCell = Math.max(1, ...stats.cells.map(cell => cell.links.length));
  const maxMonth = Math.max(1, ...stats.chronology.flatMap(month => [month.links.length, month.documents.length]));
  const countryRows = stats.countries.filter(country => `${country.code} ${country.label}`.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  const focused = focus ? stats.links.filter(link => focus.ids.includes(link.id)) : [];
  const focusedRecords = [...new Set(focused.flatMap(link => link.support.map(([id]) => id)))];
  const label = networkLayers.find(item => item.id === layer)!.label;
  function inspect(label: string, items: AtlasLink[]) {
    setFocus({ label, ids: items.map(link => link.id) });
    requestAnimationFrame(() => evidenceRef.current?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
  }
  const pairLabel = (codes: string[]) => codes.map(code => stats.areas.get(code)).join(` ${arrow} `);
  return <div className={styles.network} role="region" aria-label="Network analysis">
    <div className={styles.scope}><span><Waypoints size={15} aria-hidden />{label}</span><AtlasScope label="Network methods & references" title="Reading the reporting network"><NetworkMethods /></AtlasScope></div>
    <dl className={styles.summary}>
      <div><dt>Statements</dt><dd>{stats.links.length}</dd></div>
      <div><dt>Linked countries</dt><dd>{stats.countries.length}</dd></div>
      <div><dt>Supporting documents</dt><dd>{stats.documents.length}<small> / {stats.selectedDocuments}</small></dd></div>
      <div><dt>Document coverage</dt><dd>{stats.selectedDocuments ? `${(100 * stats.documents.length / stats.selectedDocuments).toFixed(1)}%` : '—'}</dd></div>
    </dl>
    <p className={styles.caption}>Selected documents supporting this layer · {rows.length.toLocaleString()} report entries in scope.</p>
    {!stats.links.length && <p className={styles.empty}>No geographic statements in this layer meet the complete reporting selection. Reports can remain in scope without geographic links.</p>}
    <div className={styles.grid}>
      <section className={styles.card} aria-labelledby="atlas-network-countries">
        <header><h3 id="atlas-network-countries"><Waypoints size={16} aria-hidden />Country connectivity</h3><small>{stats.countries.length} countries</small></header>
        <p className={styles.caption}>Distinct connected countries alongside reporting volume.</p>
        <label className={styles.search}><Search size={14} aria-hidden /><input aria-label="Find a network country" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a country…" type="search" /></label>
        <div className={styles.tableScroll} role="region" tabIndex={0} aria-label="Country connectivity table">
          <table className={styles.table}><thead><tr><th scope="col">Country</th><th scope="col">Peers</th><th scope="col">Statements</th><th scope="col">Docs</th></tr></thead><tbody>
            {countryRows.map(country => <tr key={country.code}><th scope="row"><button title={directed ? `${country.incoming} incoming · ${country.outgoing} outgoing statements` : country.label} onClick={() => inspect(country.label, country.links)}><LocationSymbol code={country.code} /><span>{country.label}</span></button></th><td>{country.neighbors.size}</td><td>{country.links.length}</td><td>{country.documents.length}</td></tr>)}
          </tbody></table>
          {!countryRows.length && <p className={styles.empty}>No matching countries.</p>}
        </div>
        <details className={styles.details}><summary>{stats.components.length} connected components · {stats.unlinked.length} reported countries without a link</summary>
          <p>Component sizes: {stats.components.length ? stats.components.map(component => component.length).join(', ') : 'none'}. Direction is ignored for component membership. Paths can join reports about unrelated topics.</p>
          <p>Countries below have eligible location memberships but no statement in this layer. This does not establish epidemiological isolation.</p>
          <div className={styles.countryList}>{stats.unlinked.map(country => <button key={country.code} onClick={() => onReport(country.records)}><LocationSymbol code={country.code} />{country.label}</button>)}</div>
        </details>
      </section>
      <section className={styles.card} aria-labelledby="atlas-network-geography">
        <header><h3 id="atlas-network-geography"><Globe2 size={16} aria-hidden />Geographic connections</h3><small>{stats.pairs.length} country pairs</small></header>
        <p className={styles.caption}>{directed ? 'Origin rows → destination columns.' : 'Unordered pairs, shown once.'} Diagonal cells stay within one continent.</p>
        <div className={styles.matrixScroll}><table className={styles.matrix} aria-label="Continent connection matrix"><thead><tr><th scope="col"><span className="sr-only">{directed ? 'Origin / destination' : 'Continent pair'}</span></th>{regions.map(region => <th scope="col" key={region.id} title={region.name}>{region.short.replace('America', 'Am.').slice(0, 7)}</th>)}</tr></thead><tbody>{regions.map((from, rowIndex) => <tr key={from.id}><th scope="row">{from.short}</th>{regions.map((to, columnIndex) => {
          const hidden = !directed && columnIndex < rowIndex;
          const codes = directed ? [from.id, to.id] : [from.id, to.id].sort();
          const cell = stats.cells.find(cell => cell.id === JSON.stringify(codes));
          const count = cell?.links.length ?? 0;
          const name = `${from.name} ${arrow} ${to.name}: ${count} statements, ${cell?.documents.length ?? 0} supporting documents`;
          return <td key={to.id}>{!hidden && <button disabled={!count} aria-label={name} title={name} style={{ '--network-intensity': count / maxCell } as React.CSSProperties} onClick={() => inspect(`${from.name} ${arrow} ${to.name}`, cell!.links)}>{count || '·'}</button>}</td>;
        })}</tr>)}</tbody></table></div>
        <AtlasSelect label="Network country pair" searchable value="" summaryLabel="Explore a country pair" disabled={!stats.pairs.length} items={stats.pairs.map(pair => ({ value: pair.id, label: pairLabel(pair.countries), badges: [{ kind: 'count', label: `${pair.links.length} statements · ${pair.documents.length} documents` }] }))} onChange={id => { const pair = stats.pairs.find(pair => pair.id === id)!; inspect(pairLabel(pair.countries), pair.links); }} />
        <p className={styles.caption}>{stats.domestic.links.length} same-country statements · {stats.unresolved.links.length} with unresolved country endpoints.</p>
      </section>
      <section className={styles.card} aria-labelledby="atlas-network-support">
        <header><h3 id="atlas-network-support"><FileText size={16} aria-hidden />Documentary support</h3><small>{stats.organizations.length} organizations</small></header>
        <p className={styles.caption}>Distinct captured documents by publishing channel. Breadth does not establish independent corroboration.</p>
        <div className={styles.sources} role="region" tabIndex={0} aria-label="Supporting publication channels">{stats.sources.map(source => <button key={source.id} onClick={() => inspect(source.label, source.links)} title={`${source.sourceDocuments} of ${stats.documents.length} supporting documents`}><span>{source.label}</span><strong>{source.sourceDocuments}</strong><i style={{ width: `${100 * source.sourceDocuments / stats.documents.length}%` }} /></button>)}</div>
        {!stats.sources.length && <p className={styles.empty}>No supporting documents in this layer.</p>}
        {stats.sources.length > 0 && <p className={styles.caption}>Largest channel: <strong>{(100 * stats.sources[0].sourceDocuments / stats.documents.length).toFixed(1)}%</strong> of supporting documents.</p>}
        <details className={styles.details}><summary>Repeat-report review · research preview</summary><AtlasNetworkReview key={release.export_id} release={release} linkIds={stats.links.map(link => link.id)} recordIds={recordIds} compact /></details>
      </section>
      <section className={styles.card} aria-labelledby="atlas-network-chronology">
        <header><h3 id="atlas-network-chronology"><CalendarDays size={16} aria-hidden />Reporting chronology</h3><small>{basis === 'capture' ? 'Capture' : 'Publication'}</small></header>
        <p className={styles.caption}>Each statement is dated by its latest supporting {basis === 'capture' ? 'capture' : 'publication'}. These are reporting dates.</p>
        <div className={styles.chronology} role="region" tabIndex={0} aria-label="Monthly geographic statements">{stats.chronology.map(month => <button key={month.month} disabled={!month.links.length} onClick={() => inspect(`${formatDate(`${month.month}-01`).slice(3)}${month.partial ? ' · partial month' : ''}`, month.links)} title={`${month.month}${month.partial ? ' (partial month)' : ''}: ${month.links.length} statements · ${month.documents.length} supporting documents · ${month.selectedDocuments} selected documents dated in this month`}>
          <strong>{month.links.length}</strong><span className={styles.barTrack}><i style={{ height: `${100 * month.links.length / maxMonth}%` }} /><i data-documents style={{ height: `${100 * month.documents.length / maxMonth}%` }} /></span><span>{new Date(`${month.month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}{month.partial ? '*' : ''}</span><small>{month.month.slice(0, 4)}</small>
        </button>)}</div>
        <div className={styles.legend}><span><i />Statements</span><span><i data-documents />Supporting documents</span></div>
        <p className={styles.caption}>* Partial calendar month. Documents may support statements in several months. {stats.undated.length} statements lack a complete supporting date.</p>
      </section>
    </div>
    <section ref={evidenceRef} className={`${styles.card} ${styles.evidence}`} aria-labelledby="atlas-network-evidence">
      <header><h3 id="atlas-network-evidence"><Layers3 size={16} aria-hidden />{focus?.label ?? 'Connection evidence'}</h3>{focus ? <button className={styles.action} onClick={() => setFocus(null)}><ArrowLeft size={13} aria-hidden />Clear focus</button> : <button className={styles.action} disabled={!stats.links.length} onClick={() => inspect('All statements in this layer', stats.links)}>Explore all<ArrowRight size={13} aria-hidden /></button>}</header>
      {focus ? <>
        <div className={styles.evidenceSummary}><span>{focused.length} statements · {new Set(focusedRecords.map(id => lookup.get(id)!.document_id)).size} documents · {new Set(focusedRecords.map(id => lookup.get(id)!.source)).size} channels</span><button className={styles.action} disabled={!focusedRecords.length} onClick={() => onReport(focusedRecords)}>View reports<ArrowRight size={13} aria-hidden /></button></div>
        <div className={styles.statements}>{focused.map(link => {
          const ids = [...new Set(link.support.map(([id]) => id))];
          return <details key={link.id} className={styles.statement}><summary><span>{link.label}</span><small>{new Set(ids.map(id => lookup.get(id)!.document_id)).size} docs</small></summary>
            <p className={styles.endpoints}>{link.from.label} {link.directed ? '→' : '—'} {link.to.label}</p><p>{link.basis}</p>{link.limit && <p className={styles.caption}>{link.limit}</p>}
            <MetricFigures kind="geographic_link" ids={[link.id]} recordIds={recordIds} compact />
            <p className={styles.caption}>{[...new Set(ids.map(id => sourceName(lookup.get(id)!.source)))].join(' · ')} · {ids.map(id => lookup.get(id)!.publication.slice(0, 10)).sort().map((date, i, dates) => i === 0 || i === dates.length - 1 ? formatDate(date) : null).filter((date, i, dates) => date && dates.indexOf(date) === i).join(' – ')}</p>
            <button className={styles.action} onClick={() => onReport(ids)}><FileText size={13} aria-hidden />Source reports & quotations<ArrowRight size={13} aria-hidden /></button>
          </details>;
        })}</div>
        {!focused.length && <p className={styles.empty}>No statements in this focus meet the current reporting selection.</p>}
      </> : <p className={styles.caption}>Choose a country, matrix cell, source or month to inspect its statements, source figures and quotations.</p>}
    </section>
  </div>;
}

function NetworkMethods() {
  return <div className="atlas-literature">
    <h3>Selection and counting</h3><p>Every supporting report entry must meet the reporting selection. Each exported relationship ID counts once. Repeated claims and report entries from the same document do not multiply statement or document counts. The four layers separate directed travel, travel with unspecified direction, shared events and source hypotheses. Travel statements may concern people, products, vessels or human remains.</p>
    <p>Document coverage is the number of distinct captured document IDs supporting the selected layer divided by all selected document IDs. A document can support several statements or layers. Distinct documents and publishing organizations do not establish independent evidence or independent events. Daily reports await canonical reconciliation before entering these analyses.</p>
    <h3>Structure and geography</h3><p>A country’s peers are its distinct counterpart countries. Statement counts describe incident relationships, with same-country statements counted once and excluded from peer degree and country-pair rankings. Connected components ignore direction and can join unrelated reporting topics. Countries without a link come from eligible location memberships, respecting the context setting.</p>
    <p>Country identity follows explicit endpoint area codes. Ambiguous or missing country endpoints are excluded from geographic aggregation, with their statement count retained. Continents follow <a href="https://github.com/unicode-org/cldr-json/blob/48.0.0/cldr-json/cldr-core/supplemental/territoryContainment.json" target="_blank" rel="noopener noreferrer">Unicode CLDR territory containment</a>, with Antarctica separate and unassigned codes retained. Continent diagonal cells include links between different countries in the same continent. Reference coordinates locate reporting areas; they do not measure journey distances or infection sites.</p>
    <h3>Reporting and review</h3><p>Monthly bins assign each statement to the latest supporting publication or capture date. Supporting documents are deduplicated within each bin. Reporting dates are not observation or travel dates. Repeat-report groups are applied only when every member and supporting record is selected. Their correction is partial; independent episode counts and uncertainty intervals are unavailable.</p>
    <p>Source figures retain their exported units, periods, qualifiers and conflicts. They do not weight the network and are not pooled across statements. Network position describes recorded associations, not transmission, incidence or comparative risk.</p>
    <h3>Reference</h3><p>Barrat A et al. (2004). <a href="https://doi.org/10.1073/pnas.0400087101" target="_blank" rel="noopener noreferrer">The architecture of complex weighted networks.</a> <i>PNAS</i> 101, 3747–3752. The distinction between degree and strength motivates showing distinct peers alongside statement counts; the ATLAS counting and selection rules are defined above.</p>
  </div>;
}
