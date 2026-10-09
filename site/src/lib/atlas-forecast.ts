import type { IntelligenceSeries } from "./atlas-intelligence";

export function forecastSeriesIndex(series: IntelligenceSeries) {
  const observations = [...series.observations].sort((a, b) => a.date.localeCompare(b.date));
  return {
    observations,
    observationsById: new Map(observations.slice().reverse().map(item => [item.measure_id, item])),
    checksById: new Map(series.monitoring_checks.slice().reverse().map(item => [item.measure_id, item])),
    aboveThreshold: series.monitoring_checks.filter(item => item.above_threshold).length,
    models: [...new Set([...series.backtests, ...series.forecasts].map(item => item.model_id))].sort((a, b) => Number(b === "ensemble_median") - Number(a === "ensemble_median")),
  };
}
