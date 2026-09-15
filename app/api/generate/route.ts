import { generateObject } from "ai";
import { surfaceSchema } from "@/lib/surface";

export const maxDuration = 60;

const system = `You are the interface composer for AnswerSurface.

Your job is NOT to answer every request as prose. Choose the smallest useful combination of visual/interactive blocks that makes the answer easier to understand, compare, decide with, or explore.

Rules:
- Return a valid SurfaceSpec only.
- Prefer 2-5 blocks. Do not use every block type just because it exists.
- comparison: use when the user is choosing between options.
- ranking: use when prioritisation is useful. Scores must be defensible, not fake precision; explain the basis.
- timeline: use for chronology or staged plans.
- bars: use only for meaningful non-negative quantitative comparisons.
- scenario: use when the user benefits from changing assumptions. The displayed result is base + sum(currentInputValue * coefficient). Choose coefficients and defaults so that relationship is understandable and state assumptions clearly.
- steps: use for mechanisms, procedures, or sequential explanations.
- metrics: use for a small number of key numbers or headline facts.
- note: use for assumptions, limitations, uncertainty, or warnings.
- Do not fabricate current facts, prices, statistics, citations, or measurements. If the request needs live/current information that was not provided, say so clearly in a note block and make the rest of the surface useful without pretending you browsed the web.
- Keep text compact. The interface should do the explanatory work.
- Follow-up prompts should be concrete transformations or deeper explorations of the current answer.
- Do not include markdown tables inside strings; use the comparison block instead.
`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return Response.json({ error: "A prompt is required." }, { status: 400 });
    }

    if (prompt.length > 6000) {
      return Response.json({ error: "Prompt is too long for this V0." }, { status: 400 });
    }

    const { object } = await generateObject({
      model: "openai/gpt-5.6-sol",
      schema: surfaceSchema,
      system,
      prompt,
    });

    return Response.json(object);
  } catch (error) {
    console.error("surface_generation_failed", error);
    return Response.json(
      { error: "The surface could not be generated. Check AI Gateway configuration and try again." },
      { status: 500 },
    );
  }
}
