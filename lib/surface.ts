import { z } from "zod";

const keySchema = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/);
const valueFormatSchema = z.enum(["number", "currency", "percent", "compact"]);

const metricBlock = z.object({
  type: z.literal("metrics"),
  title: z.string(),
  items: z.array(z.object({
    label: z.string(),
    value: z.string(),
    detail: z.string().optional(),
  })).min(1).max(6),
});

const comparisonBlock = z.object({
  type: z.literal("comparison"),
  title: z.string(),
  columns: z.array(z.string()).min(2).max(5),
  rows: z.array(z.object({
    label: z.string(),
    values: z.array(z.string()).min(2).max(5),
  })).min(1).max(10),
});

const timelineBlock = z.object({
  type: z.literal("timeline"),
  title: z.string(),
  items: z.array(z.object({
    date: z.string(),
    title: z.string(),
    detail: z.string(),
  })).min(2).max(12),
});

const barsBlock = z.object({
  type: z.literal("bars"),
  title: z.string(),
  unit: z.string().optional(),
  items: z.array(z.object({
    label: z.string(),
    value: z.number().nonnegative(),
    detail: z.string().optional(),
  })).min(2).max(10),
});

const rankingBlock = z.object({
  type: z.literal("ranking"),
  title: z.string(),
  items: z.array(z.object({
    name: z.string(),
    score: z.number().min(0).max(100),
    reason: z.string(),
  })).min(2).max(8),
});

const stepsBlock = z.object({
  type: z.literal("steps"),
  title: z.string(),
  items: z.array(z.object({
    title: z.string(),
    detail: z.string(),
  })).min(2).max(10),
});

const noteBlock = z.object({
  type: z.literal("note"),
  tone: z.enum(["info", "assumption", "warning"]),
  title: z.string(),
  body: z.string(),
});

// Legacy V0 scenario block retained so older generated surfaces still render.
const scenarioBlock = z.object({
  type: z.literal("scenario"),
  title: z.string(),
  description: z.string(),
  unit: z.string(),
  base: z.number(),
  inputs: z.array(z.object({
    key: keySchema,
    label: z.string(),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    default: z.number(),
    coefficient: z.number(),
    suffix: z.string().optional(),
  })).min(1).max(5),
  resultLabel: z.string(),
  explanation: z.string(),
});

export const modelInputSchema = z.object({
  key: keySchema,
  label: z.string(),
  description: z.string().optional(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  default: z.number(),
  format: valueFormatSchema.optional(),
  unit: z.string().optional(),
});

export const modelFormulaSchema = z.object({
  key: keySchema,
  label: z.string(),
  expression: z.string().min(1).max(500),
  description: z.string().optional(),
  format: valueFormatSchema.optional(),
  unit: z.string().optional(),
});

export const modelOutputSchema = z.object({
  key: keySchema,
  label: z.string(),
  detail: z.string().optional(),
  format: valueFormatSchema.optional(),
  unit: z.string().optional(),
  emphasis: z.enum(["primary", "secondary"]).optional(),
});

export const modelSeriesSchema = z.object({
  key: keySchema,
  label: z.string(),
  expression: z.string().min(1).max(500),
  from: z.number(),
  to: z.number(),
  step: z.number().positive(),
  format: valueFormatSchema.optional(),
  unit: z.string().optional(),
});

export const modelStressTestSchema = z.object({
  label: z.string(),
  rationale: z.string(),
  changes: z.array(z.object({
    key: keySchema,
    value: z.number(),
  })).min(1).max(6),
});

export const modelDecisionSchema = z.object({
  leftKey: keySchema,
  leftLabel: z.string(),
  rightKey: keySchema,
  rightLabel: z.string(),
  objective: z.enum(["higher", "lower"]),
});

export const realityModelSchema = z.object({
  title: z.string(),
  description: z.string(),
  inputs: z.array(modelInputSchema).min(1).max(6),
  formulas: z.array(modelFormulaSchema).min(1).max(16),
  outputs: z.array(modelOutputSchema).min(1).max(8),
  series: z.array(modelSeriesSchema).max(4),
  stressTests: z.array(modelStressTestSchema).max(4),
  decision: modelDecisionSchema.optional(),
  assumptions: z.array(z.string()).max(8),
});

export const surfaceBlockSchema = z.discriminatedUnion("type", [
  metricBlock,
  comparisonBlock,
  timelineBlock,
  barsBlock,
  rankingBlock,
  stepsBlock,
  noteBlock,
  scenarioBlock,
]);

export const surfaceSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  model: realityModelSchema.optional(),
  blocks: z.array(surfaceBlockSchema).min(1).max(7),
  followUps: z.array(z.string()).max(4),
});

export type SurfaceSpec = z.infer<typeof surfaceSchema>;
export type SurfaceBlock = z.infer<typeof surfaceBlockSchema>;
export type RealityModel = z.infer<typeof realityModelSchema>;
export type ModelInput = z.infer<typeof modelInputSchema>;
export type ModelFormula = z.infer<typeof modelFormulaSchema>;
export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type ModelSeries = z.infer<typeof modelSeriesSchema>;
export type ModelStressTest = z.infer<typeof modelStressTestSchema>;
export type ModelDecision = z.infer<typeof modelDecisionSchema>;
export type ValueFormat = z.infer<typeof valueFormatSchema>;
