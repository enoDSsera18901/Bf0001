# AnswerSurface

**Ask a question. Get the right interface — not just a paragraph.**

AnswerSurface is a small generative-UI experiment built from public generative UI patterns, especially CopilotKit's `generative-ui-playground` and Vercel AI SDK structured-output examples.

A prompt is sent to a model, which returns a validated declarative UI specification. The browser renders that spec using trusted React components. The model does **not** execute arbitrary JavaScript.

## V0 surfaces

- comparison boards
- ranked decision lists
- timelines
- bar visualisations
- interactive scenario sliders
- step-by-step explainers
- summary / metric cards

## Run locally

```bash
npm install
vercel link
vercel env pull .env.local
npm run dev
```

The app uses Vercel AI Gateway through the AI SDK. On Vercel, OIDC authentication is handled automatically. For local development, `vercel env pull` supplies the short-lived OIDC token.

## Acceptance test

Ask five substantially different questions and verify that the app chooses and renders substantially different useful interfaces rather than falling back to the same chat response.

Suggested prompts:

- `Compare buying a $35k used car outright vs financing it over five years.`
- `Show me the major milestones in the Apollo program as a timeline.`
- `Build me an interactive break-even explorer for a side business selling a $40 product.`
- `Rank five approaches to learning Python for someone who already knows Excel well.`
- `Explain how a transformer model processes a sentence, visually and step by step.`

## Reference implementations

- https://github.com/CopilotKit/generative-ui-playground
- https://github.com/CopilotKit/CopilotKit/tree/main/examples/showcases/generative-ui-playground
- https://vercel.com/docs/ai-sdk

## Scope

This is deliberately a one-night V0: no auth, database, agent framework, workflow engine, or generated executable code. The goal is to prove the generative-interface loop first.
