import { describe, expect, it } from "vitest";
import { decisionThresholds } from "./decision-threshold";
import { defaultValues, prepareModel } from "./model-engine";
import type { RealityModel } from "./surface";

function thresholdModel(): RealityModel {
  return {
    title: "Threshold model",
    description: "A decision with two one-variable flip points.",
    inputs: [
      { key: "growth", label: "Growth", min: 0, max: 10, step: 0.1, default: 8 },
      { key: "risk", label: "Risk", min: 0, max: 10, step: 0.1, default: 2 },
      { key: "irrelevant", label: "Irrelevant", min: 0, max: 10, step: 1, default: 5 },
    ],
    formulas: [
      { key: "left", label: "A", expression: "growth - risk" },
      { key: "right", label: "B", expression: "4" },
    ],
    outputs: [{ key: "left", label: "A" }, { key: "right", label: "B" }],
    series: [],
    stressTests: [],
    decision: { leftKey: "left", leftLabel: "A", rightKey: "right", rightLabel: "B", objective: "higher" },
    assumptions: [],
  };
}

describe("decision thresholds", () => {
  it("finds and refines the nearest one-variable decision crossings", () => {
    const model = thresholdModel();
    const prepared = prepareModel(model);
    const results = decisionThresholds(prepared, defaultValues(model));

    const growth = results.find((result) => result.input.key === "growth")!;
    const risk = results.find((result) => result.input.key === "risk")!;
    const irrelevant = results.find((result) => result.input.key === "irrelevant")!;

    expect(growth.found).toBe(true);
    expect(growth.boundaryValue).toBeCloseTo(6, 6);
    expect(growth.after?.winnerLabel).toBe("B");

    expect(risk.found).toBe(true);
    expect(risk.boundaryValue).toBeCloseTo(4, 6);
    expect(risk.after?.winnerLabel).toBe("B");

    expect(irrelevant.found).toBe(false);
    expect(irrelevant.boundaryValue).toBeNull();
  });

  it("orders reachable thresholds ahead of assumptions that cannot flip the decision alone", () => {
    const model = thresholdModel();
    const results = decisionThresholds(prepareModel(model), defaultValues(model));
    expect(results.slice(0, 2).every((result) => result.found)).toBe(true);
    expect(results.at(-1)?.input.key).toBe("irrelevant");
  });

  it("rejects threshold analysis without a declared decision", () => {
    const model = thresholdModel();
    delete model.decision;
    const prepared = prepareModel(model);
    expect(() => decisionThresholds(prepared, defaultValues(model))).toThrow(/declared decision/i);
  });
});
