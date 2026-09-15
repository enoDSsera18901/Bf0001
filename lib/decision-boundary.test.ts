import { describe, expect, it } from "vitest";
import { decisionBoundary, nearestBoundaryCell } from "./decision-boundary";
import { defaultValues, prepareModel } from "./model-engine";
import type { RealityModel } from "./surface";

function boundaryModel(): RealityModel {
  return {
    title: "Decision boundary test",
    description: "Two inputs with a diagonal decision boundary.",
    inputs: [
      { key: "upside", label: "Upside", min: 0, max: 10, step: 1, default: 7 },
      { key: "risk", label: "Risk", min: 0, max: 10, step: 1, default: 3 },
    ],
    formulas: [
      { key: "left", label: "Option A", expression: "upside - risk" },
      { key: "right", label: "Option B", expression: "1" },
    ],
    outputs: [{ key: "left", label: "A" }, { key: "right", label: "B" }],
    series: [],
    stressTests: [],
    decision: { leftKey: "left", leftLabel: "A", rightKey: "right", rightLabel: "B", objective: "higher" },
    assumptions: [],
  };
}

describe("decision boundary", () => {
  it("maps both decision regimes across a bounded 2D grid", () => {
    const model = boundaryModel();
    const prepared = prepareModel(model);
    const result = decisionBoundary(prepared, defaultValues(model), "upside", "risk", 15);

    expect(result.cells).toHaveLength(225);
    expect(result.xInput.key).toBe("upside");
    expect(result.yInput.key).toBe("risk");
    expect(new Set(result.cells.map((cell) => cell.snapshot.winnerLabel))).toEqual(new Set(["A", "B", "Tie"]));
    expect(result.maxAbsMargin).toBeGreaterThan(0);
  });

  it("rejects invalid axes and excessive grid sizes", () => {
    const prepared = prepareModel(boundaryModel());
    const values = defaultValues(prepared.model);
    expect(() => decisionBoundary(prepared, values, "upside", "upside")).toThrow(/different inputs/i);
    expect(() => decisionBoundary(prepared, values, "upside", "missing")).toThrow(/model inputs/i);
    expect(() => decisionBoundary(prepared, values, "upside", "risk", 50)).toThrow(/5–25/i);
  });

  it("finds the grid cell nearest the current live scenario", () => {
    const model = boundaryModel();
    const prepared = prepareModel(model);
    const values = { upside: 7.1, risk: 3.2 };
    const result = decisionBoundary(prepared, values, "upside", "risk", 15);
    const nearest = nearestBoundaryCell(result, values);
    expect(nearest).not.toBeNull();
    expect(Math.abs(nearest!.x - values.upside)).toBeLessThan(1);
    expect(Math.abs(nearest!.y - values.risk)).toBeLessThan(1);
  });
});
