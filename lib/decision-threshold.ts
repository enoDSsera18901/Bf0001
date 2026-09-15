import { clampValues, decisionSnapshot, type DecisionSnapshot, type PreparedModel } from "./model-engine";
import type { ModelInput } from "./surface";

export type DecisionThreshold = {
  input: ModelInput;
  current: number;
  found: boolean;
  boundaryValue: number | null;
  applyValue: number | null;
  delta: number | null;
  distance: number | null;
  before: DecisionSnapshot;
  after: DecisionSnapshot | null;
};

const EPSILON = 1e-9;

function sign(value: number): -1 | 0 | 1 {
  if (value > EPSILON) return 1;
  if (value < -EPSILON) return -1;
  return 0;
}

function sampleValues(input: ModelInput, current: number, samples: number): number[] {
  const values = [current];
  for (let index = 0; index < samples; index += 1) {
    const fraction = samples === 1 ? 0 : index / (samples - 1);
    values.push(input.min + (input.max - input.min) * fraction);
  }
  return [...new Set(values.map((value) => Number(value.toPrecision(12))))].sort((a, b) => a - b);
}

function refineCrossing(
  prepared: PreparedModel,
  baseValues: Record<string, number>,
  key: string,
  current: number,
  opposite: number,
): number {
  let left = current;
  let right = opposite;
  let leftMargin = decisionSnapshot(prepared, { ...baseValues, [key]: left })!.margin;
  let rightMargin = decisionSnapshot(prepared, { ...baseValues, [key]: right })!.margin;

  if (sign(leftMargin) === 0) return left;
  if (sign(rightMargin) === 0) return right;
  if (sign(leftMargin) === sign(rightMargin)) return opposite;

  for (let iteration = 0; iteration < 48; iteration += 1) {
    const midpoint = (left + right) / 2;
    const midpointMargin = decisionSnapshot(prepared, { ...baseValues, [key]: midpoint })!.margin;
    const midpointSign = sign(midpointMargin);
    if (midpointSign === 0) return midpoint;
    if (midpointSign === sign(leftMargin)) {
      left = midpoint;
      leftMargin = midpointMargin;
    } else {
      right = midpoint;
      rightMargin = midpointMargin;
    }
    if (Math.abs(right - left) <= Math.max(1e-10, Math.abs(opposite - current) * 1e-10)) break;
  }

  return (left + right) / 2;
}

export function decisionThresholds(
  prepared: PreparedModel,
  values: Record<string, number>,
  samples = 101,
): DecisionThreshold[] {
  if (!prepared.model.decision) throw new Error("Threshold analysis requires a declared decision rule.");
  if (!Number.isInteger(samples) || samples < 21 || samples > 201) throw new Error("Threshold scan must use 21–201 samples.");

  const baseValues = clampValues(prepared.model, values);
  const before = decisionSnapshot(prepared, baseValues)!;
  if (before.winner === "tie") throw new Error("Threshold analysis requires a non-tie current decision.");
  const baselineSign = sign(before.margin);

  const results = prepared.model.inputs.map((input): DecisionThreshold => {
    const current = baseValues[input.key];
    const candidates = sampleValues(input, current, samples)
      .map((value) => ({ value, snapshot: decisionSnapshot(prepared, { ...baseValues, [input.key]: value })! }))
      .filter((candidate) => candidate.snapshot.winner !== "tie" && sign(candidate.snapshot.margin) === -baselineSign)
      .sort((a, b) => Math.abs(a.value - current) - Math.abs(b.value - current));

    const nearestOpposite = candidates[0];
    if (!nearestOpposite) {
      return {
        input,
        current,
        found: false,
        boundaryValue: null,
        applyValue: null,
        delta: null,
        distance: null,
        before,
        after: null,
      };
    }

    const boundaryValue = refineCrossing(prepared, baseValues, input.key, current, nearestOpposite.value);
    const direction = Math.sign(nearestOpposite.value - current) || 1;
    const range = input.max - input.min;
    const nudge = Math.max(input.step, range / 10_000);
    let applyValue = Math.min(input.max, Math.max(input.min, boundaryValue + direction * nudge));
    let after = decisionSnapshot(prepared, { ...baseValues, [input.key]: applyValue })!;

    if (after.winner === before.winner || after.winner === "tie") {
      applyValue = nearestOpposite.value;
      after = nearestOpposite.snapshot;
    }

    return {
      input,
      current,
      found: true,
      boundaryValue,
      applyValue,
      delta: boundaryValue - current,
      distance: Math.abs(boundaryValue - current) / range,
      before,
      after,
    };
  });

  return results.sort((a, b) => {
    if (a.found !== b.found) return a.found ? -1 : 1;
    return (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY);
  });
}
