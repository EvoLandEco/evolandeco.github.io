import { z } from "zod";
import { atlasOrigin, verifiedBytes, type AtlasRelease } from "./atlas-release";

// ATLAS Intelligence experiment contract 0.2.0.
const intelligenceModelSchema = z.enum(["ensemble_median", "random_walk", "recent_changes", "gamma_poisson"]);

const intelligenceIntervalSchema = z.strictObject({
  level: z.union([z.literal(0.5), z.literal(0.8), z.literal(0.95)]),
  lower: z.number(),
  upper: z.number()
});

const intelligenceBacktestSchema = z.strictObject({
  model_id: intelligenceModelSchema,
  origin: z.string(),
  target: z.string(),
  horizon_weeks: z.union([z.literal(1), z.literal(2)]),
  training_measure_ids: z.array(z.string()),
  central: z.number(),
  intervals: z.array(intelligenceIntervalSchema),
  id: z.string(),
  observed: z.number(),
  target_measure_id: z.string(),
  available_in_atlas_at_origin: z.boolean(),
  mae: z.number(),
  wis: z.number()
});

const intelligenceSeriesSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  outcome: z.string(),
  unit: z.string(),
  location: z.string(),
  operation: z.literal("reported_interval_counts"),
  reviewed_at: z.string(),
  status: z.literal("retrospective_experiment"),
  observations: z.array(z.strictObject({
    date: z.string(),
    value: z.number(),
    measure_id: z.string(),
    record_id: z.string(),
    source_id: z.string(),
    publication: z.string(),
    capture: z.string(),
    segment: z.number().int().min(0)
  })),
  segments: z.array(z.array(z.string())),
  excluded: z.array(z.strictObject({
    measure_id: z.string(),
    reason: z.string()
  })),
  backtests: z.array(intelligenceBacktestSchema),
  metrics: z.array(z.strictObject({
    model_id: z.string(),
    horizon_weeks: z.number().int().min(0),
    n: z.number().int().min(0),
    mae: z.number(),
    wis: z.number(),
    relative_wis: z.union([z.number(), z.null()]),
    baseline_id: z.string(),
    coverage: z.array(z.strictObject({
      level: z.number(),
      value: z.number()
    }))
  })),
  forecasts: z.array(z.strictObject({
    model_id: intelligenceModelSchema,
    origin: z.string(),
    target: z.string(),
    horizon_weeks: z.union([z.literal(1), z.literal(2)]),
    training_measure_ids: z.array(z.string()),
    central: z.number(),
    intervals: z.array(intelligenceIntervalSchema)
  })),
  limitations: z.array(z.string()),
  source_ids: z.array(z.string()),
  monitoring_checks: z.array(z.strictObject({
    date: z.string(),
    origin: z.string(),
    measure_id: z.string(),
    record_id: z.string(),
    source_id: z.string(),
    observed: z.number(),
    expected: z.number(),
    threshold: z.number(),
    above_threshold: z.boolean()
  }))
});

const intelligenceSignalSchema = z.strictObject({
  id: z.string(),
  kind: z.union([z.literal("count_exceedance"), z.literal("network_first_appearance")]),
  label: z.string(),
  date: z.string(),
  series_id: z.union([z.string(), z.null()]),
  observed: z.union([z.number(), z.null()]),
  expected: z.union([z.number(), z.null()]),
  threshold: z.union([z.number(), z.null()]),
  unit: z.string(),
  method_id: z.string(),
  record_ids: z.array(z.string()),
  source_ids: z.array(z.string()),
  relationship_ids: z.array(z.string()),
  interpretation: z.string(),
  eligibility: z.strictObject({
    status: z.literal("retrospective_only"),
    reason: z.string()
  })
});

const intelligenceProfileSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  record_id: z.string(),
  assessment_date: z.union([z.string(), z.null()]),
  authority: z.string(),
  assessments: z.array(z.strictObject({
    population: z.string(),
    rating: z.string(),
    basis: z.literal("source_reported"),
    assertion_ids: z.array(z.string())
  })),
  dimensions: z.array(z.strictObject({
    id: z.string(),
    label: z.string(),
    summary: z.string(),
    assertion_ids: z.array(z.string())
  })),
  unknowns: z.array(z.string()),
  evidence: z.array(z.strictObject({
    assertion_id: z.string(),
    text: z.string(),
    quotes: z.array(z.strictObject({
      id: z.string(),
      quote: z.string(),
      page: z.union([z.union([z.number().int(), z.string()]), z.null()]),
      quote_sha256: z.string()
    }))
  })),
  source_ids: z.array(z.string()),
  publication: z.string(),
  capture: z.string(),
  probability: z.null(),
  method_id: z.literal("risk_evidence"),
  review_status: z.literal("source_checked_experiment"),
  one_health: z.strictObject({
    nodes: z.array(z.record(z.string(), z.unknown())),
    relations: z.array(z.record(z.string(), z.unknown()))
  })
});

const intelligenceMethodSchema = z.strictObject({
  id: z.string().refine(id => id !== "ensemble_median"),
  label: z.string(),
  description: z.string(),
  url: z.union([z.url({ protocol: /^https?$/ }), z.null()])
});

export const intelligenceSchema = z.strictObject({
  schema_version: z.literal("0.2.0"),
  experiment_id: z.string(),
  generated_at: z.string(),
  source_export_id: z.string(),
  input_identity: z.strictObject({
    site_sha256: z.string(),
    selector_sha256: z.string(),
    producer_sha256: z.string(),
    profile_sha256: z.string(),
    method_version: z.literal("0.2.0"),
    schema_sha256: z.string(),
    selection_adapter_sha256: z.string(),
    network_method_sha256: z.string()
  }),
  time_basis: z.literal("retrospective_observation_order"),
  status: z.literal("research_experiment"),
  scope: z.strictObject({
    publication_from: z.string(),
    publication_until: z.string(),
    capture_until: z.string(),
    documents: z.number().int().min(0),
    records: z.number().int().min(0),
    forecast_series: z.number().int().min(0),
    risk_profiles: z.number().int().min(0)
  }),
  limitations: z.array(z.string()),
  methods: z.array(z.union([
    intelligenceMethodSchema.extend({
      id: z.literal("ensemble_median"),
      combination: z.literal("equal_weight_quantile_median"),
      require_all_components: z.literal(true),
      components: z.tuple([
        z.strictObject({ model_id: z.literal("random_walk"), weight: z.literal(1 / 3) }),
        z.strictObject({ model_id: z.literal("recent_changes"), weight: z.literal(1 / 3) }),
        z.strictObject({ model_id: z.literal("gamma_poisson"), weight: z.literal(1 / 3) })
      ])
    }),
    intelligenceMethodSchema
  ])),
  sources: z.array(z.strictObject({
    id: z.string(),
    title: z.string(),
    url: z.url({ protocol: /^https?$/ }),
    publication: z.string(),
    capture: z.string(),
    text_sha256: z.string()
  })),
  series_audit: z.array(z.strictObject({
    series_id: z.string(),
    status: z.union([z.literal("included"), z.literal("excluded")]),
    reason: z.string()
  })),
  monitoring: z.array(intelligenceSignalSchema),
  risk_profiles: z.array(intelligenceProfileSchema),
  forecast_series: z.array(intelligenceSeriesSchema)
});

export type IntelligenceExperiment = z.infer<typeof intelligenceSchema>;
export type IntelligenceSeries = IntelligenceExperiment["forecast_series"][number];
export type IntelligenceForecast = IntelligenceSeries["forecasts"][number];
export type IntelligenceBacktest = IntelligenceSeries["backtests"][number];

export type AtlasExperiment = { data?: IntelligenceExperiment; digest?: string; error?: string };

export function validateIntelligenceRelease(data: IntelligenceExperiment, release: AtlasRelease) {
  if (data.experiment_id !== release.intelligence?.experiment_id || data.schema_version !== release.intelligence.schema_version ||
      data.source_export_id !== release.export_id || data.input_identity.site_sha256 !== release.assets["atlas-site.json"].sha256 ||
      data.input_identity.selector_sha256 !== release.selector_sha256)
    throw new Error("Analysis does not match this ATLAS release.");
  return data;
}

export async function fetchAtlasIntelligence(release: AtlasRelease, signal?: AbortSignal): Promise<AtlasExperiment> {
  const descriptor = release.intelligence;
  if (!descriptor) return { error: "No validated analysis is published for this dataset." };
  const bytes = await verifiedBytes(await fetch(`${atlasOrigin}/intelligence/${descriptor.experiment_id}/intelligence.json`, { signal }), descriptor.asset);
  signal?.throwIfAborted();
  const data = validateIntelligenceRelease(intelligenceSchema.parse(JSON.parse(new TextDecoder().decode(bytes))), release);
  return { data, digest: descriptor.asset.sha256 };
}
