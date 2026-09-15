# AnswerSurface · Reality Lab

**Ask a question. Get something you can manipulate, stress-test and inspect — not just a paragraph.**

AnswerSurface started as a one-night generative-UI experiment built from public implementation patterns. V0.2 adds a bounded deterministic model layer so quantitative answers can become small interactive instruments rather than decorative cards.

## What V0.2 does

A prompt goes to GPT-5.6 Sol through the Vercel AI SDK. The model returns a validated declarative `SurfaceSpec`. For suitable quantitative questions it can also return a `RealityModel`:

```text
inputs → formulas → outputs
            ↓
      decision / series
```

The browser then evaluates that model locally. The generated model never becomes executable JavaScript.

### Reality Lab controls

- **Simulator** — change assumptions with sliders or numeric inputs and recompute outputs immediately.
- **Timeline** — evaluate model-defined expressions over a bounded `t` range and render the series.
- **Sensitivity** — move each input across its declared full range, one at a time, and rank how much it changes the decision margin or primary output.
- **Logic** — inspect every generated formula, its dependencies, current value and declared assumptions.
- **Stress Test** — apply model-defined bounded scenarios plus deterministic min/max corner searches for best/worst decision margin.
- **Break This** — when the model defines a legitimate two-sided numeric decision, search combinations of current/default/min/max input values for the nearest tested scenario that reverses the winner. If no reversal is found, say so.

## Safe calculation grammar

Formula strings are parsed to an AST with [JSEP](https://github.com/EricSmekens/jsep), following the same broad parse-then-interpret pattern used by the public [`math.gl` expression evaluator](https://github.com/visgl/math.gl/blob/master/modules/expressions/src/expression-eval.ts).

AnswerSurface deliberately supports a smaller grammar:

- numeric and boolean literals;
- named model variables;
- `+ - * / % **`;
- numeric comparisons and boolean `&& || !`;
- ternary conditions through the official `@jsep-plugin/ternary` plugin;
- an explicit function allowlist: `min`, `max`, `abs`, `floor`, `ceil`, `sqrt`, `log`, `exp`, `pow`, `round`, `clamp`, `monthly_payment`, `loan_balance`, `compound`, `annuity`.

It rejects member/property access, arrays, objects, assignment, `Math.*`, function definitions and arbitrary function calls.

Formula dependencies are resolved as a DAG. Cycles and unknown variables are rejected before execution.

## Existing generative surfaces

The original declarative renderer remains available for questions better answered without a numeric model:

- comparison boards;
- ranked decision lists;
- timelines;
- bar visualisations;
- step-by-step explainers;
- summary / metric cards;
- notes / limitations.

The old linear `scenario` block remains readable for backwards compatibility but the generation prompt no longer asks the model to create it.

## Acceptance prompts

Good tests for the V0.2 model layer:

- `Build an interactive rent-vs-buy model for a $650k Adelaide home. Use clearly labelled illustrative assumptions and show what would flip the decision.`
- `Build me an interactive break-even model for a side business selling a $40 product, including fixed costs, unit cost, monthly volume and a stress test.`
- `Compare two job offers as a manipulable decision: $120k salary with no packaging versus $80k at an eligible not-for-profit with $15,900 salary packaging. State tax simplifications clearly.`

And non-model surfaces should still work:

- `Show me the major milestones in the Apollo program as a timeline.`
- `Explain how a transformer model processes a sentence, visually and step by step.`

## Verification

```bash
npm install
npm test
npm run build
```

The deterministic test suite covers:

- formula dependency ordering;
- cycle rejection;
- member-access and arbitrary-call rejection;
- ternary evaluation;
- mortgage/compound primitives;
- bounded time series;
- stress validation;
- sensitivity analysis;
- decision extremes;
- a genuine decision flip found by `Break This`.

## Run locally with AI generation

```bash
npm install
vercel link
vercel env pull .env.local
npm run dev
```

Vercel AI Gateway supplies the model connection. The deterministic model engine itself does not need an AI connection once a valid `RealityModel` exists.

## What this does **not** prove

Reality Lab makes the *calculation* inspectable and deterministic. It does **not** make an LLM-generated assumption factual.

- A formula can be internally correct while its assumed growth rate, tax treatment or market input is wrong.
- No live browsing is performed by this V0 unless a future tool explicitly supplies evidence.
- `Break This` is a bounded discrete search over current/default/min/max values. It is useful adversarial testing, not a mathematical proof that no continuous reversal exists.
- Algorithmic best/worst cases search min/max corners; they are not global optimisation for every nonlinear model.
- Financial examples are modelling tools, not financial advice.

Those constraints are deliberate. V0.2 proves the core loop before adding evidence retrieval, optimisation or persistence.

## Public implementation references

- [CopilotKit generative-ui-playground](https://github.com/CopilotKit/generative-ui-playground) — declarative / generative UI reference.
- [CopilotKit monorepo generative UI showcase](https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui-playground).
- [Vercel AI SDK](https://vercel.com/docs/ai-sdk) — typed structured model output.
- [JSEP](https://github.com/EricSmekens/jsep) — expression parser.
- [JSEP ternary plugin](https://github.com/EricSmekens/jsep/tree/master/packages/ternary) — official ternary AST support.
- [`math.gl` expression evaluator](https://github.com/visgl/math.gl/blob/master/modules/expressions/src/expression-eval.ts) — public AST evaluation/security pattern reference.

See `THIRD_PARTY_NOTICES.md` for attribution.
