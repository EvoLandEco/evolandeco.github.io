import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IntelligenceSeries } from '../src/lib/atlas-intelligence';
import { forecastSeriesIndex } from '../src/lib/atlas-forecast';

function fixture(): IntelligenceSeries {
  const observation = (id: string, date: string) => ({ date, value: 10, measure_id: id, record_id: `record-${id}`, source_id: 'source', publication: date, capture: date, segment: 0 });
  const prediction = (model_id: IntelligenceSeries['forecasts'][number]['model_id']) => ({ model_id, origin: '2026-01-08', target: '2026-01-15', horizon_weeks: 1 as const, training_measure_ids: ['first', 'second'], central: 10, intervals: [{ level: .5 as const, lower: 5, upper: 15 }] });
  return {
    id: 'series', label: 'Reported cases', outcome: 'cases', unit: 'count', location: 'Country', operation: 'reported_interval_counts', reviewed_at: '2026-01-15', status: 'retrospective_experiment',
    observations: [observation('second', '2026-01-08'), observation('first', '2026-01-01'), observation('third', '2026-01-15')],
    segments: [['first', 'second', 'third']], excluded: [], limitations: [], source_ids: ['source'], metrics: [],
    backtests: [{ ...prediction('random_walk'), id: 'backtest', observed: 10, target_measure_id: 'third', available_in_atlas_at_origin: false, mae: 0, wis: 1 }],
    forecasts: [prediction('gamma_poisson'), prediction('ensemble_median'), prediction('random_walk')],
    monitoring_checks: [{ date: '2026-01-15', origin: '2026-01-08', measure_id: 'third', record_id: 'record-third', source_id: 'source', observed: 10, expected: 8, threshold: 9, above_threshold: true }],
  };
}

test('Forecast indexes retain source objects and sparse checks without changing their order', () => {
  const series = fixture();
  Object.freeze(series.observations);
  Object.freeze(series.monitoring_checks);
  const index = forecastSeriesIndex(series);
  assert.deepEqual(series.observations.map(item => item.measure_id), ['second', 'first', 'third']);
  assert.deepEqual(index.observations.map(item => item.measure_id), ['first', 'second', 'third']);
  assert.equal(index.observationsById.get('third'), series.observations[2]);
  assert.equal(index.checksById.get('third'), series.monitoring_checks[0]);
  assert.equal(index.checksById.get('first'), undefined);
  assert.equal(index.aboveThreshold, 1);
  assert.deepEqual(index.models, ['ensemble_median', 'random_walk', 'gamma_poisson']);
});

test('Repeated chart and source lookups do not rescan exported checks', () => {
  const series = fixture();
  let reads = 0;
  series.monitoring_checks = Array.from({ length: 1000 }, (_, index) => ({
    ...series.monitoring_checks[0],
    get measure_id() { reads++; return `measure-${index}`; },
  }));
  const index = forecastSeriesIndex(series);
  assert.equal(reads, 1000);
  for (let interaction = 0; interaction < 100; interaction++) {
    assert.equal(index.checksById.get('measure-999'), series.monitoring_checks[999]);
    assert.equal(index.checksById.get('missing'), undefined);
  }
  assert.equal(reads, 1000);
});


test('Indexes preserve the first matching check and earliest matching observation', () => {
  const series = fixture();
  series.observations.unshift({ ...series.observations[2], date: '2026-01-22', value: 20 });
  series.monitoring_checks.push({ ...series.monitoring_checks[0], expected: 999, above_threshold: false });
  const index = forecastSeriesIndex(series);
  assert.equal(index.observationsById.get('third')!.value, 10);
  assert.equal(index.checksById.get('third')!.expected, 8);
  assert.equal(index.aboveThreshold, 1);
});

test('Model choices use exported models when no ensemble or no prediction is present', () => {
  const series = fixture();
  series.forecasts = series.forecasts.filter(item => item.model_id !== 'ensemble_median');
  assert.deepEqual(forecastSeriesIndex(series).models, ['random_walk', 'gamma_poisson']);
  series.forecasts = [];
  series.backtests = [];
  const checks = forecastSeriesIndex(series);
  assert.deepEqual(checks.models, []);
  assert.equal(checks.observations.length, 3);
  assert.equal(checks.checksById.size, 1);
});
