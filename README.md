# AnswerSurface · Reality Lab

**Ask a question. Get something you can manipulate, stress-test and inspect — not just a paragraph.**

AnswerSurface started as a one-night generative-UI experiment built from public implementation patterns. V0.2 adds a bounded deterministic model layer so quantitative answers can become small interactive instruments rather than decorative cards.

## Core loop

A prompt goes to GPT-5.6 Sol through the Vercel AI SDK. The model returns a schema-validated `SurfaceSpec`. When assumptions matter it can include a `RealityModel`:

```text
inputs → formulas → outputs
            ↓
 decision / series / counterfactual views
```

The browser evaluates that model locally. Generated formulas are parsed to an AST and interpreted by trusted code; they never become executable JavaScript.

## Reality Lab views

- **Simulator** — change assumptions and recompute outputs immediately.
- **Timeline** — evaluate bounded model expressions over `t` and render time/quantity series.
- **Sensitivity** — move each input across its declared range one at a time and rank its effect on the decision margin or primary output.
- **Boundary** — evaluate a 15×15 grid across two assumptions and show where a declared decision changes winner. The two most sensitive inputs are selected first, axes can be changed, and a cell can be clicked to apply that scenario.
- **Thresholds** — hold every other assumption fixed and find/refine the nearest one-variable crossing that would reverse the current declared decision. Inputs that cannot flip it alone are reported as such.
- **Logic** — inspect every formula, dependency, current result and declared assumption.

The model also provides:

- **Stress Test** — apply declared bounded scenarios plus deterministic min/max-corner best/worst cases.
- **Break This** — search current/default/min/midpoint/max combinations for a bounded multi-assumption scenario that reverses the declared winner.

These are deliberately bounded analyses. Boundary is a finite 2D slice, Thresholds is a one-dimensional counterfactual, and Break This is a finite grid search; none is presented as a proof of a continuous global optimum.

## Safe calculation grammar

Formula strings are parsed with [JSEP](https://github.com/EricSmekens/jsep), following the broad parse-then-interpret pattern used by the public [`math.gl` expression evaluator](https://github.com/visgl/math.gl/blob/master/modules/expressions/src/expression-eval.ts).

Allowed:

- numeric and boolean literals;
- named model variables;
- `+ - * / % **`;
- numeric comparisons and `&& || !`;
- ternary conditions via the official `@jsep-plugin/ternary` plugin;
- explicit functions only: `min`, `max`, `abs`, `floor`, `ceil`, `sqrt`, `log`, `exp`, `pow`, `round`, `clamp`, `monthly_payment`, `loan_balance`, `compound`, `annuity`.

Rejected:

- strings;
- member/property access;
- arrays and objects;
- assignment;
- `Math.*`;
- function definitions;
- arbitrary calls.

Formula dependencies are resolved as a DAG. Cycles and unknown variables are rejected before execution.

## Semantic model validation and repair

A Zod-valid model can still be mathematically broken. Before an AI-generated model reaches the browser, the server now:

1. parses and validates the formula graph;
2. evaluates defaults;
3. evaluates each input at min / midpoint / max with the other inputs at defaults;
4. evaluates every min/max corner of the declared input domain (at most 64 for six inputs);
5. evaluates every time-series expression at every probe;
6. checks sensitivity, decision extremes and declared stress tests.

If semantic validation fails, GPT-5.6 Sol receives the exact deterministic failure and gets **one bounded repair attempt**. A failed model cannot evade repair by simply deleting itself.

## Deterministic no-AI demo

The landing page contains a committed product-launch model that requires no model/API call. It exists so the actual product loop can be tested reproducibly.

At its defaults it declares `Launch` with A$4,600 monthly operating profit. The acceptance suite then proves, in a real Chrome browser, that it can:

- set monthly units to 100 and flip to `Do not launch` at -A$8,400;
- reset;
- apply a Demand Shock stress case and flip the decision;
- run Break This, find a bounded reversal and apply it;
- render Timeline and Sensitivity;
- render a 225-cell Boundary map, mark the current scenario and apply a clicked cell;
- compute one-variable Thresholds, apply a reachable threshold and verify the winner reverses;
- render the inspectable Logic view.

The workflow uploads screenshots of Boundary, Thresholds and Logic as a short-lived `browser-acceptance` artifact.

## Existing non-model surfaces

For questions better answered without a numeric model, the original renderer still supports:

- comparison boards;
- ranked lists;
- timelines;
- bar visualisations;
- step-by-step explainers;
- metric cards;
- notes / limitations.

The old linear `scenario` block remains readable for backwards compatibility but the generation prompt no longer asks the model to create it.

## Verification

```bash
npm install
npm test
npm run build
npm run test:e2e
```

Unit tests cover formula ordering, cycles, unsafe expression rejection, ternaries, finance primitives, time series, domain failures away from defaults, stress bounds, sensitivity, nonlinear decision flips, decision-boundary mapping and one-variable threshold solving.

Playwright runs against `next start` in the GitHub runner's real stable Chrome. The browser acceptance does not need an AI key because it uses the deterministic demo model.

## Run locally with AI generation

```bash
npm install
vercel link
vercel env pull .env.local
npm run dev
```

Vercel AI Gateway supplies the model connection. The deterministic model engine and built-in demo do not need an AI connection once a valid `RealityModel` exists.

## Current deployment limitation

The repository builds and passes real browser acceptance, but it is not yet bound to a dedicated Vercel project. Vercel CLI deployment from CI requires a project binding plus `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`; OIDC does not replace the CLI deployment token. The implementation deliberately does not reuse or overwrite one of the account's existing Vercel projects.

## What this does **not** prove

Reality Lab makes the *calculation* inspectable and deterministic. It does **not** make an LLM-generated assumption factual.

- A formula can be internally correct while its assumed growth rate, tax treatment or market input is wrong.
- No live browsing/evidence retrieval is performed by this V0 unless a future tool explicitly supplies evidence.
- Break This can miss reversals between its sampled grid points.
- Boundary holds non-axis inputs fixed and evaluates a finite 15×15 slice.
- Thresholds changes one input at a time and does not claim assumptions are independent in the real world.
- Algorithmic best/worst stress cases search min/max corners, not the global optimum of every nonlinear model.
- Financial examples are modelling tools, not financial advice.

Those constraints are deliberate. V0.2 proves the model/manipulation loop before adding live evidence retrieval, continuous optimisation or persistent multi-model state.

## Public implementation references

- [CopilotKit generative-ui-playground](https://github.com/CopilotKit/generative-ui-playground) — declarative generative-UI reference.
- [CopilotKit monorepo generative UI showcase](https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui-playground).
- [Vercel AI SDK](https://vercel.com/docs/ai-sdk) — typed structured model output.
- [JSEP](https://github.com/EricSmekens/jsep) — expression parser.
- [JSEP ternary plugin](https://github.com/EricSmekens/jsep/tree/master/packages/ternary) — official ternary AST support.
- [`math.gl` expression evaluator](https://github.com/visgl/math.gl/blob/master/modules/expressions/src/expression-eval.ts) — AST evaluation/security-pattern reference.

See `THIRD_PARTY_NOTICES.md` for attribution.
