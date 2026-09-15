import { describe, expect, it } from "vitest";
import { demoSurface } from "./demo-surface";
import { defaultValues, evaluatePrepared, findDecisionFlip, prepareModel } from "./model-engine";
import { surfaceSchema } from "./surface";

describe("deterministic demo surface", () => {
  it("is schema-valid, executable and breakable without an AI call", () => {
    expect(() => surfaceSchema.parse(demoSurface)).not.toThrow();
    expect(demoSurface.model).toBeDefined();

    const model = demoSurface.model!;
    const prepared = prepareModel(model);
    const defaults = defaultValues(model);
    const result = evaluatePrepared(prepared, defaults);

    expect(result.profit).toBe(4600);
    expect(result.break_even_units).toBeCloseTo(423.08, 1);

    const broken = findDecisionFlip(prepared, defaults);
    expect(broken?.found).toBe(true);
    expect(broken?.before.winnerLabel).toBe("Launch");
    expect(broken?.after.winnerLabel).toBe("Do not launch");
  });
});
