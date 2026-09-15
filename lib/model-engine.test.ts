import { describe, expect, it } from "vitest";
import type { RealityModel } from "./surface";
import {
  applyStress,
  decisionSnapshot,
  defaultValues,
  evaluatePrepared,
  evaluateSeries,
  findDecisionExtremes,
  findDecisionFlip,
  prepareModel,
  sensitivity,
  validatePreparedDomain,
} from "./model-engine";

function businessModel(): RealityModel {
  return {
    title: "Unit economics",
    description: "Simple deterministic side-business model.",
    inputs: [
      { key: "price", label: "Price", min: 20, max: 60, step: 1, default: 40, format: "currency", unit: "AUD" },
      { key: "unit_cost", label: "Unit cost", min: 5, max: 30, step: 1, default: 12, format: "currency", unit: "AUD" },
      { key: "volume", label: "Monthly volume", min: 100, max: 3000, step: 100, default: 1000 },
      { key: "fixed", label: "Fixed cost", min: 0, max: 30000, step: 1000, default: 10000, format: "currency", unit: "AUD" },
    ],
    formulas: [
      { key: "profit", label: "Profit", expression: "revenue - variable_cost - fixed", format: "currency", unit: "AUD" },
      { key: "revenue", label: "Revenue", expression: "price * volume", format: "currency", unit: "AUD" },
      { key: "variable_cost", label: "Variable cost", expression: "unit_cost * volume", format: "currency", unit: "AUD" },
      { key: "profitable", label: "Profitable flag", expression: "profit > 0 ? 1 : 0" },
    ],
    outputs: [
      { key: "profit", label: "Profit", format: "currency", unit: "AUD", emphasis: "primary" },
      { key: "revenue", label: "Revenue", format: "currency", unit: "AUD" },
    ],
    series: [
      { key: "profit_by_volume", label: "Profit by volume", expression: "price * t - unit_cost * t - fixed", from: 100, to: 1000, step: 100, format: "currency", unit: "AUD" },
    ],
    stressTests: [
      { label: "Cost squeeze", rationale: "Higher unit cost and lower price.", changes: [{ key: "unit_cost", value: 20 }, { key: "price", value: 30 }] },
    ],
    assumptions: ["Illustrative numbers."],
  };
}

function decisionModel(): RealityModel {
  return {
    title: "Two choices",
    description: "A small model whose decision can genuinely flip.",
    inputs: [
      { key: "growth", label: "Growth", min: 0, max: 10, step: 1, default: 8 },
      { key: "risk", label: "Risk", min: 0, max: 10, step: 1, default: 2 },
    ],
    formulas: [
      { key: "left", label: "Option A score", expression: "growth - risk" },
      { key: "right", label: "Option B score", expression: "4" },
    ],
    outputs: [
      { key: "left", label: "A score" },
      { key: "right", label: "B score" },
    ],
    series: [],
    stressTests: [
      { label: "Downside", rationale: "Growth slows while risk rises.", changes: [{ key: "growth", value: 2 }, { key: "risk", value: 8 }] },
    ],
    decision: { leftKey: "left", leftLabel: "Option A", rightKey: "right", rightLabel: "Option B", objective: "higher" },
    assumptions: [],
  };
}

describe("Reality model engine", () => {
  it("topologically orders formula dependencies and evaluates a real graph", () => {
    const prepared = prepareModel(businessModel());
    expect(prepared.formulaOrder.indexOf("revenue")).toBeLessThan(prepared.formulaOrder.indexOf("profit"));
    expect(prepared.formulaOrder.indexOf("variable_cost")).toBeLessThan(prepared.formulaOrder.indexOf("profit"));

    const result = evaluatePrepared(prepared, defaultValues(prepared.model));
    expect(result.revenue).toBe(40000);
    expect(result.variable_cost).toBe(12000);
    expect(result.profit).toBe(18000);
    expect(result.profitable).toBe(1);
  });

  it("supports official JSEP ternary syntax through the registered plugin", () => {
    const prepared = prepareModel(businessModel());
    const loss = evaluatePrepared(prepared, { price: 20, unit_cost: 30, volume: 1000, fixed: 30000 });
    expect(loss.profit).toBe(-40000);
    expect(loss.profitable).toBe(0);
  });

  it("evaluates bounded time series from the same inputs", () => {
    const prepared = prepareModel(businessModel());
    const series = evaluateSeries(prepared, defaultValues(prepared.model));
    expect(series.profit_by_volume).toHaveLength(10);
    expect(series.profit_by_volume[0]).toEqual({ t: 100, value: -7200 });
    expect(series.profit_by_volume.at(-1)).toEqual({ t: 1000, value: 18000 });
  });

  it("provides mortgage and compounding primitives without arbitrary code", () => {
    const model: RealityModel = {
      title: "Finance primitives",
      description: "Known-value checks.",
      inputs: [
        { key: "principal", label: "Principal", min: 100000, max: 1000000, step: 1000, default: 500000 },
        { key: "rate", label: "Rate", min: 0.01, max: 0.12, step: 0.001, default: 0.06, format: "percent" },
        { key: "years", label: "Years", min: 5, max: 40, step: 1, default: 30 },
      ],
      formulas: [
        { key: "payment", label: "Payment", expression: "monthly_payment(principal, rate, years)" },
        { key: "future", label: "Future value", expression: "compound(principal, rate, 10, 12)" },
      ],
      outputs: [{ key: "payment", label: "Payment" }, { key: "future", label: "Future" }],
      series: [],
      stressTests: [],
      assumptions: [],
    };
    const result = evaluatePrepared(prepareModel(model), defaultValues(model));
    expect(result.payment).toBeCloseTo(2997.75, 1);
    expect(result.future).toBeCloseTo(909698.37, 1);
  });

  it("rejects cycles", () => {
    const model = businessModel();
    model.formulas = [
      { key: "a", label: "A", expression: "b + price" },
      { key: "b", label: "B", expression: "a + 1" },
    ];
    model.outputs = [{ key: "a", label: "A" }];
    expect(() => prepareModel(model)).toThrow(/cycle/i);
  });

  it("rejects member access, arbitrary function calls and string literals", () => {
    const member = businessModel();
    member.formulas = [{ key: "bad", label: "Bad", expression: "price.constructor" }];
    member.outputs = [{ key: "bad", label: "Bad" }];
    expect(() => prepareModel(member)).toThrow(/not allowed/i);

    const call = businessModel();
    call.formulas = [{ key: "bad", label: "Bad", expression: "evil(price)" }];
    call.outputs = [{ key: "bad", label: "Bad" }];
    expect(() => prepareModel(call)).toThrow(/Function evil is not allowed/i);

    const stringLiteral = businessModel();
    stringLiteral.formulas = [{ key: "bad", label: "Bad", expression: "'hello'" }];
    stringLiteral.outputs = [{ key: "bad", label: "Bad" }];
    expect(() => prepareModel(stringLiteral)).toThrow(/numeric and boolean literals/i);
  });

  it("probes the declared domain and rejects formulas that only fail away from defaults", () => {
    const model: RealityModel = {
      title: "Bad domain",
      description: "Default works but declared minimum does not.",
      inputs: [{ key: "x", label: "X", min: 0, max: 10, step: 1, default: 10 }],
      formulas: [{ key: "root", label: "Root", expression: "sqrt(x - 5)" }],
      outputs: [{ key: "root", label: "Root" }],
      series: [],
      stressTests: [],
      assumptions: [],
    };
    const prepared = prepareModel(model);
    expect(evaluatePrepared(prepared, defaultValues(model)).root).toBeCloseTo(Math.sqrt(5));
    expect(() => validatePreparedDomain(prepared)).toThrow(/inside its declared domain/i);
  });

  it("runs declared stress tests inside the validated input bounds", () => {
    const prepared = prepareModel(businessModel());
    const stressedValues = applyStress(prepared, 0);
    expect(stressedValues.price).toBe(30);
    expect(stressedValues.unit_cost).toBe(20);
    expect(evaluatePrepared(prepared, stressedValues).profit).toBe(0);
  });

  it("finds sensitivity and decision extremes deterministically", () => {
    const prepared = prepareModel(decisionModel());
    const base = defaultValues(prepared.model);
    const ranked = sensitivity(prepared, base);
    expect(ranked.map((item) => item.key).sort()).toEqual(["growth", "risk"]);
    expect(ranked[0].swing).toBe(10);

    const extremes = findDecisionExtremes(prepared);
    expect(extremes?.worst.snapshot.winner).toBe("right");
    expect(extremes?.best.snapshot.winner).toBe("left");
  });

  it("finds a bounded scenario that genuinely flips the declared decision", () => {
    const prepared = prepareModel(decisionModel());
    const base = defaultValues(prepared.model);
    expect(decisionSnapshot(prepared, base)?.winner).toBe("left");

    const broken = findDecisionFlip(prepared, base);
    expect(broken?.found).toBe(true);
    expect(broken?.before.winner).toBe("left");
    expect(broken?.after.winner).toBe("right");
    expect(Object.values(broken?.values ?? {}).every(Number.isFinite)).toBe(true);
  });

  it("checks midpoints so Break This can catch a nonlinear reversal missed by range endpoints", () => {
    const model: RealityModel = {
      title: "Midpoint reversal",
      description: "The endpoints favor A but the midpoint favors B.",
      inputs: [{ key: "x", label: "X", min: 0, max: 10, step: 1, default: 0 }],
      formulas: [
        { key: "left", label: "A", expression: "(x - 5) ** 2" },
        { key: "right", label: "B", expression: "10" },
      ],
      outputs: [{ key: "left", label: "A" }, { key: "right", label: "B" }],
      series: [],
      stressTests: [],
      decision: { leftKey: "left", leftLabel: "A", rightKey: "right", rightLabel: "B", objective: "higher" },
      assumptions: [],
    };
    const prepared = prepareModel(model);
    expect(decisionSnapshot(prepared, defaultValues(model))?.winnerLabel).toBe("A");
    const broken = findDecisionFlip(prepared, defaultValues(model));
    expect(broken?.found).toBe(true);
    expect(broken?.values.x).toBe(5);
    expect(broken?.after.winnerLabel).toBe("B");
  });

  it("rejects stress cases outside declared bounds", () => {
    const model = businessModel();
    model.stressTests = [{ label: "Invalid", rationale: "Out of bounds", changes: [{ key: "price", value: 1000 }] }];
    expect(() => prepareModel(model)).toThrow(/outside its declared range/i);
  });
});
