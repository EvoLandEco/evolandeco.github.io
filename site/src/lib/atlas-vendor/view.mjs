/* ATLAS reporting-window rules. Validate the bundle at build time with atlas site-verify. */
export const COMPACT_GROUPING_VERSION = '1.0.0';
const metricOrder = ['cases', 'deaths', 'hospitalizations', 'affected_holdings', 'affected_animals', 'samples_tested', 'positive_samples', 'test_positivity', 'other'];
const figureFields = ['label', 'metric', 'value', 'value_status', 'unit', 'count_kind', 'case_class', 'date_basis',
  'period_start', 'period_end', 'case_definition', 'population', 'stratum', 'denominator', 'denominator_status',
  'qualifier', 'origin_authority', 'disease', 'pathogen', 'host', 'geography', 'acquisition', 'transmission_role',
  'as_of', 'period_label', 'denominator_population', 'ratio_basis', 'cumulative_baseline', 'track_id',
  'review_status', 'observation_date', 'observation_date_status', 'source_date_warning'];
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;

export function selectView(data, from, until, basis = 'publication', knowledgeCutoff = null, recordSelection = null) {
  if (data.contract_version !== '1.0.0') throw new Error('Unsupported ATLAS site contract');
  const day = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!day(from) || !day(until) || from > until || !['publication', 'capture'].includes(basis)) throw new Error('Invalid reporting window');
  const cutoff = knowledgeCutoff === null ? null : Date.parse(knowledgeCutoff);
  if (cutoff !== null && (Number.isNaN(cutoff) || !/(Z|[+-]\d{2}:\d{2})$/.test(knowledgeCutoff))) throw new Error('Cutoff needs an explicit timezone');
  const cutoffDay = cutoff === null ? null : new Date(cutoff).toISOString().slice(0, 10);
  const selection = recordSelection === null ? null : new Set(recordSelection);
  if (selection && [...selection].some(id => !data.records.some(r => r.id === id))) throw new Error('Unknown selected record');
  const records = data.records.filter(r => from <= r[basis].slice(0, 10) && r[basis].slice(0, 10) <= until &&
    (selection === null || selection.has(r.id)) &&
    (cutoff === null || (Date.parse(r.capture) <= cutoff && r.publication.slice(0, 10) <= cutoffDay)));
  const recordIds = new Set(records.map(r => r.id));
  const supported = rule => rule.record_ids.every(id => recordIds.has(id));
  const assertions = data.assertions.filter(a => supported(a.eligibility));
  const comparisons = data.comparisons.filter(c => supported(c.eligibility));
  const superseded = new Set(comparisons.flatMap(c => c.lineage.map(e => e.from_assertion_id)));
  const measureIds = new Set(assertions.filter(a => a.measure_id && !superseded.has(a.id)).map(a => a.measure_id));
  const measures = new Map(data.metrics.measures.map(m => [m.measure_id, m]));
  const separateAssertions = new Set(comparisons.filter(c => ['contradiction', 'different_scope', 'unresolved_association'].includes(c.kind)).flatMap(c => c.participant_ids));
  const separateMeasures = new Set(assertions.filter(a => separateAssertions.has(a.id)).map(a => a.measure_id));
  const figureKeys = new Map(data.metrics.measures.map(m => {
    const groupable = m.value_status === 'reported' && Number.isFinite(m.value) && m.observation_date !== null &&
      m.observation_date_status === 'reported' && !m.conflict_set && !separateMeasures.has(m.measure_id) &&
      figureFields.every(field => Object.hasOwn(m, field));
    return [m.measure_id, groupable ? JSON.stringify(figureFields.map(field => ordered(m[field]))) : `measure:${m.measure_id}`];
  }));
  const panels = data.metrics.panels.map(p => {
    const ids = p.measure_ids.filter(id => measureIds.has(id));
    const groups = new Map();
    for (const id of ids) {
      const m = measures.get(id), group = groups.get(m.context_id) ?? [];
      group.push(m); groups.set(m.context_id, group);
    }
    const cards = [...groups].map(([context_id, rows]) => {
      const dates = rows.map(m => m.observation_date).filter(Boolean).sort();
      const latest = dates.at(-1) ?? null;
      const selected = latest === null ? rows : rows.filter(m => m.observation_date === latest);
      return { context_id, observation_date: latest, measure_ids: selected.map(m => m.measure_id), priority: Math.min(...selected.map(m => m.priority)) };
    }).sort((a, b) => a.priority - b.priority || (b.observation_date ?? '').localeCompare(a.observation_date ?? '') || a.context_id.localeCompare(b.context_id));
    // Display repetition is grouped after evidence filtering and before the card limit.
    const figures = new Map();
    for (const card of cards) for (const id of card.measure_ids) {
      const m = measures.get(id), key = figureKeys.get(id);
      if (!figures.has(key)) figures.set(key, {label: m.label, metric: m.metric, value: m.value, value_status: m.value_status,
        unit: m.unit, observation_date: m.observation_date, priority: card.priority, measure_ids: [], context_ids: [], source_ids: [],
        basis: 'matching_recorded_scope_and_value', comparability_status: 'not_established'});
      const figure = figures.get(key);
      figure.measure_ids.push(id); figure.context_ids.push(m.context_id); figure.source_ids.push(m.source_id);
    }
    const compact = [...figures.values()].map(g => ({...g, id: `compact:${[...g.measure_ids].sort().join('|')}`,
      context_ids: [...new Set(g.context_ids)].sort(), source_ids: [...new Set(g.source_ids)].sort()}))
      .sort((a, b) => a.priority - b.priority || (b.observation_date ?? '').localeCompare(a.observation_date ?? '') ||
        metricOrder.indexOf(a.metric) - metricOrder.indexOf(b.metric) || a.id.localeCompare(b.id));
    return { kind: p.kind, id: p.id, measure_ids: ids, card_groups: cards.slice(0, 3),
      compact_groups: compact.slice(0, 3), compact_group_count: compact.length };
  });
  const relationships = data.relationships.filter(r => supported(r.eligibility));
  const relationIds = new Set(relationships.map(r => r.id));
  const locationIds = new Set(data.location_memberships.filter(m => recordIds.has(m.record_id) && supported(m.eligibility)).map(m => m.id));
  const placeIds = data.places.filter(p => p.location_membership_ids.some(id => locationIds.has(id)) || p.relationship_ids.some(id => relationIds.has(id))).map(p => p.id);
  return {
    compact_grouping_version: COMPACT_GROUPING_VERSION,
    record_ids: records.map(r => r.id), document_ids: [...new Set(records.map(r => r.document_id))],
    assertion_ids: assertions.map(a => a.id), comparison_ids: comparisons.map(c => c.id),
    superseded_assertion_ids: [...superseded], relationship_ids: [...relationIds], place_ids: placeIds,
    location_membership_ids: [...locationIds],
    panels,
    source_coverage: data.source_coverage.map(e => ({ id: e.id, record_ids: e.record_ids.filter(id => recordIds.has(id)),
      document_ids: [...new Set(records.filter(r => e.record_ids.includes(r.id)).map(r => r.document_id))] })).filter(e => e.record_ids.length),
  };
}
