"use client";

import { FormEvent, useState } from "react";
import { SurfaceRenderer } from "@/components/surface-renderer";
import type { SurfaceSpec } from "@/lib/surface";

const examples = [
  "Build an interactive rent-vs-buy model for a $650k Adelaide home. Use clearly labelled illustrative assumptions and show what would flip the decision.",
  "Build me an interactive break-even model for a side business selling a $40 product, including fixed costs, unit cost, monthly volume and a stress test.",
  "Compare two job offers as a manipulable decision: $120k salary with no packaging versus $80k at an eligible not-for-profit with $15,900 salary packaging. State tax simplifications clearly.",
  "Show me the major milestones in the Apollo program as a timeline.",
  "Explain how a transformer model processes a sentence, visually and step by step.",
];

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [surface, setSurface] = useState<SurfaceSpec | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSpec, setShowSpec] = useState(false);

  async function generate(nextPrompt?: string) {
    const value = (nextPrompt ?? prompt).trim();
    if (!value || loading) return;

    if (nextPrompt) setPrompt(nextPrompt);
    setLoading(true);
    setError(null);
    setShowSpec(false);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value }),
      });

      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Generation failed.");
      setSurface(payload as SurfaceSpec);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void generate();
  }

  return (
    <main>
      <div className="topbar">
        <a className="brand" href="/" aria-label="AnswerSurface home">
          <span className="brand-mark">A</span>
          <span>AnswerSurface</span>
        </a>
        <div className="topbar-meta">REALITY LAB / V0.2</div>
      </div>

      {!surface && !loading && (
        <section className="landing">
          <div className="eyebrow">The answer should be something you can test.</div>
          <h1>Stop accepting<br /><em>static answers.</em></h1>
          <p className="landing-copy">
            Ask for an explanation, decision or quantitative problem. When assumptions matter, AnswerSurface builds a bounded model you can manipulate, stress-test and try to break.
          </p>
        </section>
      )}

      <section className={`composer ${surface ? "composer-compact" : ""}`}>
        <form onSubmit={submit}>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="What do you want to understand, compare, model or decide?"
            rows={surface ? 2 : 4}
            disabled={loading}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void generate();
              }
            }}
          />
          <div className="composer-footer">
            <span>⌘ / Ctrl + Enter</span>
            <button className="generate-button" type="submit" disabled={loading || !prompt.trim()}>
              {loading ? <><span className="spinner" /> Composing</> : <>Build answer <span>↗</span></>}
            </button>
          </div>
        </form>

        {!surface && !loading && (
          <div className="examples">
            <span>Try one</span>
            <div className="example-grid">
              {examples.map((example) => <button key={example} onClick={() => void generate(example)}>{example}</button>)}
            </div>
          </div>
        )}
      </section>

      {loading && (
        <section className="loading-stage">
          <div className="loader-orbit"><span /><span /><span /></div>
          <h2>Composing the model…</h2>
          <p>The model is producing a typed interface and, where useful, a safe calculation graph.</p>
        </section>
      )}

      {error && (
        <section className="error-card">
          <strong>Surface generation failed.</strong>
          <p>{error}</p>
          <button onClick={() => void generate()}>Try again</button>
        </section>
      )}

      {surface && !loading && (
        <>
          <SurfaceRenderer surface={surface} onFollowUp={(value) => void generate(value)} />
          <div className="spec-tools">
            <button onClick={() => setShowSpec((current) => !current)}>{showSpec ? "Hide" : "Inspect"} generated spec</button>
            <button onClick={() => { setSurface(null); setPrompt(""); setError(null); }}>New question</button>
          </div>
          {showSpec && <pre className="spec-view">{JSON.stringify(surface, null, 2)}</pre>}
        </>
      )}

      <footer>
        <span>Built from public generative-UI and expression-evaluation patterns.</span>
        <span>Typed output · safe AST interpreter · deterministic stress/search · no generated JS</span>
      </footer>
    </main>
  );
}
