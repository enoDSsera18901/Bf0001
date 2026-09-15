import type { ModelInput } from "./surface";
import { clampValues, decisionSnapshot, type DecisionSnapshot, type PreparedModel } from "./model-engine";

export type BoundaryCell = {
  row: number;
  column: number;
  x: number;
  y: number;
  snapshot: DecisionSnapshot;
};

export type BoundaryResult = {
  xInput: ModelInput;
  yInput: ModelInput;
  steps: number;
  cells: BoundaryCell[];
  maxAbsMargin: number;
};

export function decisionBoundary(
  prepared: PreparedModel,
  values: Record<string, number>,
  xKey: string,
  yKey: string,
  steps = 15,
): BoundaryResult {
  if (!prepared.model.decision) throw new Error("Decision boundary requires a declared decision rule.");
  if (xKey === yKey) throw new Error("Decision boundary axes must use different inputs.");
  if (!Number.isInteger(steps) || steps < 5 || steps > 25) throw new Error("Decision boundary grid must use 5–25 steps.");

  const xInput = prepared.model.inputs.find((input) => input.key === xKey);
  const yInput = prepared.model.inputs.find((input) => input.key === yKey);
  if (!xInput || !yInput) throw new Error("Decision boundary axes must reference model inputs.");

  const base = clampValues(prepared.model, values);
  const cells: BoundaryCell[] = [];
  let maxAbsMargin = 0;

  for (let row = 0; row < steps; row += 1) {
    const yFraction = steps === 1 ? 0 : 1 - row / (steps - 1);
    const y = yInput.min + (yInput.max - yInput.min) * yFraction;

    for (let column = 0; column < steps; column += 1) {
      const xFraction = steps === 1 ? 0 : column / (steps - 1);
      const x = xInput.min + (xInput.max - xInput.min) * xFraction;
      const snapshot = decisionSnapshot(prepared, { ...base, [xKey]: x, [yKey]: y });
      if (!snapshot) throw new Error("Decision boundary could not evaluate the declared decision.");
      maxAbsMargin = Math.max(maxAbsMargin, Math.abs(snapshot.margin));
      cells.push({ row, column, x, y, snapshot });
    }
  }

  return { xInput, yInput, steps, cells, maxAbsMargin: Math.max(maxAbsMargin, 1e-9) };
}

export function nearestBoundaryCell(result: BoundaryResult, values: Record<string, number>): BoundaryCell | null {
  const currentX = values[result.xInput.key];
  const currentY = values[result.yInput.key];
  if (!Number.isFinite(currentX) || !Number.isFinite(currentY)) return null;

  let nearest: BoundaryCell | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  const xRange = Math.max(1e-9, result.xInput.max - result.xInput.min);
  const yRange = Math.max(1e-9, result.yInput.max - result.yInput.min);

  for (const cell of result.cells) {
    const dx = (cell.x - currentX) / xRange;
    const dy = (cell.y - currentY) / yRange;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = cell;
    }
  }

  return nearest;
}
