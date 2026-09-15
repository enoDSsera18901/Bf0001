import { z } from "zod";

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

const scenarioBlock = z.object({
  type: z.literal("scenario"),
  title: z.string(),
  description: z.string(),
  unit: z.string(),
  base: z.number(),
  inputs: z.array(z.object({
    key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
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
  blocks: z.array(surfaceBlockSchema).min(1).max(7),
  followUps: z.array(z.string()).max(4),
});

export type SurfaceSpec = z.infer<typeof surfaceSchema>;
export type SurfaceBlock = z.infer<typeof surfaceBlockSchema>;
