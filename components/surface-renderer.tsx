"use client";

import { useMemo, useState } from "react";
import { RealityModel } from "@/components/reality-model";
import type { SurfaceBlock, SurfaceSpec } from "@/lib/surface";

function Metrics({ block }: { block: Extract<SurfaceBlock, { type: "metrics" }> }) {
  return (
    <section className="surface-card">
      <div className="section-kicker">Key signals</div>
      <h2>{block.title}</h2>
      <div className="metric-grid">
        {block.items.map((item) => (
          <div className="metric" key={`${item.label}-${item.value}`}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            {item.detail && <small>{item.detail}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Comparison({ block }: { block: Extract<SurfaceBlock, { type: "comparison" }> }) {
  return (
    <section className="surface-card wide-card">
      <div className="section-kicker">Compare</div>
      <h2>{block.title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dimension</th>
              {block.columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <tr key={row.label}>
                <th>{row.label}</th>
                {block.columns.map((_, index) => <td key={index}>{row.values[index] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Timeline({ block }: { block: Extract<SurfaceBlock, { type: "timeline" }> }) {
  return (
    <section className="surface-card">
      <div className="section-kicker">Timeline</div>
      <h2>{block.title}</h2>
      <div className="timeline">
        {block.items.map((item, index) => (
          <div className="timeline-item" key={`${item.date}-${item.title}-${index}`}>
            <div className="timeline-marker">{index + 1}</div>
            <div>
              <time>{item.date}</time>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Bars({ block }: { block: Extract<SurfaceBlock, { type: "bars" }> }) {
  const max = Math.max(1, ...block.items.map((item) => item.value));
  return (
    <section className="surface-card">
      <div className="section-kicker">Visual comparison</div>
      <h2>{block.title}</h2>
      <div className="bars">
        {block.items.map((item) => (
          <div className="bar-row" key={item.label}>
            <div className="bar-meta">
              <span>{item.label}</span>
              <strong>{item.value.toLocaleString()} {block.unit ?? ""}</strong>
            </div>
            <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }} /></div>
            {item.detail && <small>{item.detail}</small>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Ranking({ block }: { block: Extract<SurfaceBlock, { type: "ranking" }> }) {
  const items = [...block.items].sort((a, b) => b.score - a.score);
  return (
    <section className="surface-card">
      <div className="section-kicker">Ranked</div>
      <h2>{block.title}</h2>
      <div className="ranking-list">
        {items.map((item, index) => (
          <div className="rank-item" key={item.name}>
            <div className="rank-number">{index + 1}</div>
            <div className="rank-content">
              <div className="rank-head"><strong>{item.name}</strong><span>{Math.round(item.score)}/100</span></div>
              <div className="score-track"><div className="score-fill" style={{ width: `${Math.max(0, Math.min(100, item.score))}%` }} /></div>
              <p>{item.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Steps({ block }: { block: Extract<SurfaceBlock, { type: "steps" }> }) {
  return (
    <section className="surface-card">
      <div className="section-kicker">How it works</div>
      <h2>{block.title}</h2>
      <div className="step-flow">
        {block.items.map((item, index) => (
          <div className="step" key={`${item.title}-${index}`}>
            <div className="step-index">{String(index + 1).padStart(2, "0")}</div>
            <div><h3>{item.title}</h3><p>{item.detail}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Note({ block }: { block: Extract<SurfaceBlock, { type: "note" }> }) {
  return (
    <section className={`surface-card note note-${block.tone}`}>
      <div className="section-kicker">{block.tone}</div>
      <h2>{block.title}</h2>
      <p>{block.body}</p>
    </section>
  );
}

function Scenario({ block }: { block: Extract<SurfaceBlock, { type: "scenario" }> }) {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(block.inputs.map((input) => [input.key, input.default])));
  const result = useMemo(() => block.base + block.inputs.reduce((total, input) => total + (values[input.key] ?? input.default) * input.coefficient, 0), [block, values]);
  const formattedResult = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(result);

  return (
    <section className="surface-card scenario-card">
      <div className="section-kicker">Legacy scenario</div>
      <h2>{block.title}</h2>
      <p className="muted">{block.description}</p>
      <div className="scenario-result">
        <span>{block.resultLabel}</span>
        <strong>{formattedResult} <small>{block.unit}</small></strong>
      </div>
      <div className="sliders">
        {block.inputs.map((input) => {
          const value = values[input.key] ?? input.default;
          return (
            <label className="slider-control" key={input.key}>
              <div><span>{input.label}</span><strong>{value.toLocaleString()} {input.suffix ?? ""}</strong></div>
              <input type="range" min={input.min} max={input.max} step={input.step} value={value} onChange={(event) => setValues((current) => ({ ...current, [input.key]: Number(event.target.value) }))} />
              <div className="range-ends"><small>{input.min.toLocaleString()}</small><small>{input.max.toLocaleString()}</small></div>
            </label>
          );
        })}
      </div>
      <p className="scenario-explanation">{block.explanation}</p>
    </section>
  );
}

function BlockRenderer({ block }: { block: SurfaceBlock }) {
  switch (block.type) {
    case "metrics": return <Metrics block={block} />;
    case "comparison": return <Comparison block={block} />;
    case "timeline": return <Timeline block={block} />;
    case "bars": return <Bars block={block} />;
    case "ranking": return <Ranking block={block} />;
    case "steps": return <Steps block={block} />;
    case "note": return <Note block={block} />;
    case "scenario": return <Scenario block={block} />;
  }
}

export function SurfaceRenderer({ surface, onFollowUp }: { surface: SurfaceSpec; onFollowUp: (prompt: string) => void }) {
  return (
    <div className="surface-shell">
      <header className="surface-header">
        <div className="surface-badge"><span /> Generated surface</div>
        <h1>{surface.title}</h1>
        <p>{surface.subtitle}</p>
      </header>

      <div className="surface-grid">
        {surface.model && <div className="reality-model-wrap"><RealityModel model={surface.model} /></div>}
        {surface.blocks.map((block, index) => <BlockRenderer block={block} key={`${block.type}-${index}`} />)}
      </div>

      {surface.followUps.length > 0 && (
        <div className="followups">
          <span>Deepen this model</span>
          <div>{surface.followUps.map((prompt) => <button key={prompt} onClick={() => onFollowUp(prompt)}>{prompt}</button>)}</div>
        </div>
      )}
    </div>
  );
}
