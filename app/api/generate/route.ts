import { generateObject } from "ai";
import {
  applyStress,
  defaultValues,
  evaluatePrepared,
  findDecisionExtremes,
  prepareModel,
  sensitivity,
  validatePreparedDomain,
} from "@/lib/model-engine";
import { surfaceSchema, type SurfaceSpec } from "@/lib/surface";

export const maxDuration = 60;

const system = `You are the interface and model composer for AnswerSurface Reality Lab.

Your job is NOT to answer every request as prose. Build the smallest useful declarative surface. When a question involves quantities, trade-offs, assumptions, forecasting, break-even analysis, finance, or a decision whose answer changes when assumptions change, include a RealityModel so the user can manipulate the answer locally.

GENERAL RULES
- Return a valid SurfaceSpec only.
- Prefer 1-4 ordinary blocks plus a RealityModel when it adds real value.
- Do not use every block type just because it exists.
- Keep prose compact; the interface should do the explanatory work.
- Do not fabricate current facts, prices, statistics, citations, measurements, rates, or laws. If current/live information is required but was not supplied, say so in a note block and use clearly labelled illustrative assumptions only when that is still useful.
- comparison: choosing between options.
- ranking: prioritisation; avoid fake precision.
- timeline: chronology or staged plans.
- bars: meaningful non-negative quantitative comparison.
- steps: mechanism or procedure.
- metrics: a few headline facts.
- note: assumptions, limitations, uncertainty, or warnings.
- The old scenario block is legacy only. Do NOT generate it. Use model instead.

REALITY MODEL CONTRACT
A RealityModel is a small deterministic calculation graph: inputs -> formulas -> outputs, optionally time series and a two-sided decision rule.
- Use 2-6 inputs. Every input needs a realistic min, max, step and default.
- Every formula must remain numerically valid across the entire declared input range, including range corners. If a denominator could become zero or a sqrt/log domain could become invalid, guard it explicitly with max/clamp/conditionals or narrow the input range.
- Percent-formatted inputs are stored as decimals: 0.061 means 6.1%, not 6.1.
- Currency values are ordinary numeric amounts; use a three-letter unit such as AUD or USD.
- Formula keys must be unique and may reference inputs or formulas by key.
- Formula dependencies must be acyclic.
- Formulas must return numbers.
- Outputs must reference an input or formula key.
- Use formulas for genuinely derived values; do not pre-calculate changing outputs as static metrics.

SAFE FORMULA LANGUAGE
Allowed constructs only:
- numeric literals and model variable names
- + - * / % **
- < <= > >= == !=
- && || !
- ternary condition: condition ? valueA : valueB
- direct calls to these functions only:
  min(...) max(...) abs(x) floor(x) ceil(x) sqrt(x) log(x) exp(x) pow(x,y) round(x,digits) clamp(x,min,max)
  monthly_payment(principal, annualRateDecimal, years[, periodsPerYear])
  loan_balance(principal, annualRateDecimal, years, elapsedYears[, periodsPerYear])
  compound(principal, annualRateDecimal, years[, periodsPerYear])
  annuity(contributionPerPeriod, annualRateDecimal, years[, periodsPerYear])
Do NOT emit strings, JavaScript, property access, arrays, objects, assignment, Math.*, function definitions, or arbitrary calls.

TIME SERIES
- series.expression uses the same safe language and may additionally reference t.
- t is the x-axis value, normally years.
- Put time-varying calculations in series expressions rather than formulas that reference t.
- Limit each series to 2-80 points.
- Series expressions must also remain numerically valid across their entire t range and the model's declared input range.
- For long-horizon finance, useful patterns include compound(..., t) and loan_balance(..., t).

DECISIONS
When two outcomes can be compared numerically, add decision:
- leftKey/rightKey must reference numeric model keys.
- objective='higher' means the larger value wins; objective='lower' means the smaller value wins.
- Choose comparable values with matching meaning/units.
This powers a deterministic bounded search that attempts to flip the conclusion, so do not create a decision rule unless the comparison is legitimate.

STRESS TESTS
- Provide 1-4 named stress tests only when meaningful.
- Each stress change must target an input and stay within its declared min/max range.
- Stress cases should test distinct mechanisms, not cosmetic variations.

ASSUMPTIONS
- Declare important simplifications explicitly.
- If a model is illustrative because live facts were unavailable, say that clearly.

FOLLOW-UPS
- Follow-up prompts should deepen or replace the underlying model/content, not merely ask to change visual layout. The user can already Morph locally between Simulator, Timeline, Sensitivity and Logic.
`;

function semanticModelError(surface: SurfaceSpec): string | null {
  if (!surface.model) return null;
  try {
    const prepared = prepareModel(surface.model);
    validatePreparedDomain(prepared);
    const defaults = defaultValues(surface.model);
    sensitivity(prepared, defaults);
    if (surface.model.decision) findDecisionExtremes(prepared);
    for (let index = 0; index < surface.model.stressTests.length; index += 1) {
      evaluatePrepared(prepared, applyStress(prepared, index));
    }
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Unknown semantic model error.";
  }
}

async function compose(prompt: string): Promise<SurfaceSpec> {
  const first = await generateObject({
    model: "openai/gpt-5.6-sol",
    schema: surfaceSchema,
    system,
    prompt,
  });

  const firstError = semanticModelError(first.object);
  if (!firstError) return first.object;

  console.warn("reality_model_semantic_repair", firstError);
  const priorModel = JSON.stringify(first.object.model ?? null);
  const repairPrompt = `ORIGINAL USER REQUEST:\n${prompt}\n\nYour previous RealityModel passed the JSON schema but failed deterministic semantic validation:\n${firstError}\n\nPREVIOUS MODEL JSON:\n${priorModel}\n\nReturn a complete corrected SurfaceSpec. If the previous response contained a RealityModel, the corrected response MUST still contain a RealityModel. Fix the actual formula/dependency/range/domain problem; do not evade validation by deleting the model. Use only the allowed formula grammar in the system instructions.`;

  const repaired = await generateObject({
    model: "openai/gpt-5.6-sol",
    schema: surfaceSchema,
    system,
    prompt: repairPrompt,
  });

  const repairedError = semanticModelError(repaired.object);
  if (repairedError) throw new Error(`RealityModel failed semantic validation after repair: ${repairedError}`);
  if (first.object.model && !repaired.object.model) throw new Error("RealityModel repair removed the model instead of fixing it.");
  return repaired.object;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) return Response.json({ error: "A prompt is required." }, { status: 400 });
    if (prompt.length > 6000) return Response.json({ error: "Prompt is too long for this V0." }, { status: 400 });

    return Response.json(await compose(prompt));
  } catch (error) {
    console.error("surface_generation_failed", error);
    return Response.json(
      { error: "The surface could not be generated as a valid model. Check AI Gateway configuration and try again." },
      { status: 500 },
    );
  }
}
