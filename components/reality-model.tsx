"use client";

import { useEffect, useMemo, useState } from "react";
import { DecisionBoundary } from "@/components/decision-boundary";
import type { ModelInput, ModelOutput, RealityModel as RealityModelSpec, ValueFormat } from "@/lib/surface";
import {
  applyStress,
  clampValues,
  decisionSnapshot,
  defaultValues,
  evaluatePrepared,
  evaluateSeries,
  findDecisionExtremes,
  findDecisionFlip,
  prepareModel,
  sensitivity,
  type BreakSearchResult,
  type DecisionSnapshot,
  type PreparedModel,
} from "@/lib/model-engine";

type View = "simulator" | "timeline" | "sensitivity" | "boundary" | "logic";

function currencyCode(unit?: string): string {
  return unit && /^[A-Z]{3}$/.test(unit) ? unit : "AUD";
}

function formatValue(value: number, format?: ValueFormat, unit?: string): string {
  if (!Number.isFinite(value)) return "—";
  if (format === "currency") {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currencyCode(unit),
      maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
    }).format(value);
  }
  if (format === "percent") {
    return new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 2 }).format(value);
  }
  if (format === "compact") {
    return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  }
  const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${number} ${unit}` : number;
}

function inputLabel(input: ModelInput, value: number): string {
  return formatValue(value, input.format, input.unit);
}

function outputForKey(model: RealityModelSpec, key: string): ModelOutput | undefined {
  return model.outputs.find((output) => output.key === key);
}

function displayKey(model: RealityModelSpec, key: string, value: number): string {
  const output = outputForKey(model, key);
  const formula = model.formulas.find((candidate) => candidate.key === key);
  return formatValue(value, output?.format ?? formula?.format, output?.unit ?? formula?.unit);
}

function DecisionCard({ model, snapshot }: { model: RealityModelSpec; snapshot: DecisionSnapshot }) {
  const decision = model.decision!;
  return (
    <div className="decision-card">
      <div className="decision-topline">
        <span>Current conclusion</span>
        <strong>{snapshot.winnerLabel}</strong>
      </div>
      <div className="decision-sides">
        <div className={snapshot.winner === "left" ? "decision-winner" : ""}>
          <span>{decision.leftLabel}</span>
          <strong>{displayKey(model, decision.leftKey, snapshot.left)}</strong>
        </div>
        <div className={snapshot.winner === "right" ? "decision-winner" : ""}>
          <span>{decision.rightLabel}</span>
          <strong>{displayKey(model, decision.rightKey, snapshot.right)}</strong>
        </div>
      </div>
    </div>
  );
}

function ModelChart({ model, prepared, values }: { model: RealityModelSpec; prepared: PreparedModel; values: Record<string, number> }) {
  const seriesState = useMemo(() => {
    try {
      return { data: evaluateSeries(prepared, values), error: null as string | null };
    } catch (cause) {
      return { data: null, error: cause instanceof Error ? cause.message : "Time-series calculation failed." };
    }
  }, [prepared, values]);

  if (seriesState.error || !seriesState.data) {
    return <div className="lab-calc-error"><strong>Timeline stopped.</strong><span>{seriesState.error ?? "Time-series calculation failed."}</span></div>;
  }

  const data = seriesState.data;
  const width = 880;
  const height = 320;
  const padX = 54;
  const padY = 28;
  const allPoints = model.series.flatMap((series) => data[series.key] ?? []);
  if (!allPoints.length) return <div className="lab-empty">This model has no time-series view.</div>;

  const minX = Math.min(...allPoints.map((point) => point.t));
  const maxX = Math.max(...allPoints.map((point) => point.t));
  const minRaw = Math.min(...allPoints.map((point) => point.value));
  const maxRaw = Math.max(...allPoints.map((point) => point.value));
  const spread = Math.max(1e-9, maxRaw - minRaw);
  const minY = minRaw - spread * 0.08;
  const maxY = maxRaw + spread * 0.08;
  const x = (value: number) => padX + ((value - minX) / Math.max(1e-9, maxX - minX)) * (width - padX * 2);
  const y = (value: number) => height - padY - ((value - minY) / Math.max(1e-9, maxY - minY)) * (height - padY * 2);

  return (
    <div className="model-chart-shell">
      <div className="chart-legend">
        {model.series.map((series, index) => <span key={series.key}><i className={`legend-dot line-${index % 4}`} />{series.label}</span>)}
      </div>
      <svg className="model-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Model time series">
        <line className="chart-axis" x1={padX} x2={padX} y1={padY} y2={height - padY} />
        <line className="chart-axis" x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} />
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = minY + (maxY - minY) * fraction;
          const py = y(value);
          return <g key={fraction}><line className="chart-grid" x1={padX} x2={width - padX} y1={py} y2={py} /><text className="chart-label" x={padX - 8} y={py + 4} textAnchor="end">{new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(value)}</text></g>;
        })}
        <text className="chart-label" x={padX} y={height - 7}>{minX}</text>
        <text className="chart-label" x={width - padX} y={height - 7} textAnchor="end">{maxX}</text>
        {model.series.map((series, index) => {
          const points = data[series.key] ?? [];
          const d = points.map((point, pointIndex) => `${pointIndex === 0 ? "M" : "L"}${x(point.t).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
          return <path key={series.key} className={`chart-path line-${index % 4}`} d={d} />;
        })}
      </svg>
      <div className="chart-readout">
        {model.series.map((series) => {
          const points = data[series.key] ?? [];
          const last = points.at(-1);
          return <div key={series.key}><span>{series.label} at {last?.t ?? "—"}</span><strong>{last ? formatValue(last.value, series.format, series.unit) : "—"}</strong></div>;
        })}
      </div>
    </div>
  );
}

function changedInputs(model: RealityModelSpec, from: Record<string, number>, to: Record<string, number>) {
  return model.inputs.filter((input) => Math.abs((from[input.key] ?? input.default) - (to[input.key] ?? input.default)) > 1e-9);
}

export function RealityModel({ model }: { model: RealityModelSpec }) {
  const preparedState = useMemo(() => {
    try {
      return { prepared: prepareModel(model), error: null as string | null };
    } catch (cause) {
      return { prepared: null, error: cause instanceof Error ? cause.message : "Model preparation failed." };
    }
  }, [model]);
  const prepared = preparedState.prepared;
  const [values, setValues] = useState<Record<string, number>>(() => defaultValues(model));
  const [view, setView] = useState<View>("simulator");
  const [stressOpen, setStressOpen] = useState(false);
  const [breakResult, setBreakResult] = useState<BreakSearchResult | null>(null);

  useEffect(() => {
    setValues(defaultValues(model));
    setView("simulator");
    setStressOpen(false);
    setBreakResult(null);
  }, [model]);

  const calculation = useMemo(() => {
    if (!prepared) return { scope: null, decision: null, sensitivities: [], extremes: null, error: preparedState.error };
    try {
      return {
        scope: evaluatePrepared(prepared, values),
        decision: decisionSnapshot(prepared, values),
        sensitivities: sensitivity(prepared, values),
        extremes: findDecisionExtremes(prepared),
        error: null as string | null,
      };
    } catch (cause) {
      return { scope: null, decision: null, sensitivities: [], extremes: null, error: cause instanceof Error ? cause.message : "Model calculation failed." };
    }
  }, [prepared, preparedState.error, values]);

  if (!prepared) {
    return <section className="reality-lab lab-error"><div className="section-kicker">Model rejected</div><h2>{model.title}</h2><p>{preparedState.error}</p></section>;
  }

  const setInput = (key: string, value: number) => {
    setValues((current) => clampValues(model, { ...current, [key]: value }));
    setBreakResult(null);
  };

  const applyScenario = (next: Record<string, number>) => {
    setValues(clampValues(model, next));
    setView("simulator");
    setBreakResult(null);
  };

  const updateBoundaryScenario = (next: Record<string, number>) => {
    setValues(clampValues(model, next));
    setBreakResult(null);
  };

  const runBreakSearch = () => {
    try {
      setBreakResult(findDecisionFlip(prepared, values));
    } catch {
      setBreakResult(null);
    }
  };

  const target = model.decision ? "decision margin" : (model.outputs[0]?.label ?? "primary output");
  const maxSwing = Math.max(1e-9, ...calculation.sensitivities.map((item) => item.swing));
  const boundaryAvailable = Boolean(model.decision && model.inputs.length >= 2);

  return (
    <section className="reality-lab">
      <div className="lab-header">
        <div>
          <div className="section-kicker">Reality model · live</div>
          <h2>{model.title}</h2>
          <p>{model.description}</p>
        </div>
        <div className="lab-actions">
          <button className={stressOpen ? "active" : ""} onClick={() => setStressOpen((current) => !current)}>Stress test</button>
          <button onClick={runBreakSearch} disabled={!model.decision}>Break this</button>
          <button onClick={() => applyScenario(defaultValues(model))}>Reset</button>
        </div>
      </div>

      <div className="morph-bar">
        <span>Morph</span>
        {(["simulator", "timeline", "sensitivity", "boundary", "logic"] as View[]).map((candidate) => (
          <button
            key={candidate}
            className={view === candidate ? "active" : ""}
            onClick={() => setView(candidate)}
            disabled={(candidate === "timeline" && model.series.length === 0) || (candidate === "boundary" && !boundaryAvailable)}
          >
            {candidate === "simulator" ? "Simulator" : candidate === "timeline" ? "Timeline" : candidate === "sensitivity" ? "Sensitivity" : candidate === "boundary" ? "Boundary" : "Logic"}
          </button>
        ))}
      </div>

      {stressOpen && (
        <div className="stress-panel">
          <div className="stress-heading"><strong>Bounded stress cases</strong><span>Every scenario stays inside the model&apos;s declared input ranges.</span></div>
          <div className="stress-grid">
            {model.stressTests.map((stress, index) => (
              <button key={stress.label} onClick={() => applyScenario(applyStress(prepared, index))}>
                <strong>{stress.label}</strong><span>{stress.rationale}</span>
              </button>
            ))}
            {calculation.extremes && (
              <>
                <button onClick={() => applyScenario(calculation.extremes!.worst.values)}><strong>Algorithmic worst case</strong><span>Corner search that minimises the declared decision margin.</span></button>
                <button onClick={() => applyScenario(calculation.extremes!.best.values)}><strong>Algorithmic best case</strong><span>Corner search that maximises the declared decision margin.</span></button>
              </>
            )}
          </div>
        </div>
      )}

      {breakResult && (
        <div className={`break-panel ${breakResult.found ? "break-found" : ""}`}>
          <div>
            <span className="section-kicker">Break this</span>
            <h3>{breakResult.found ? `Found a scenario that flips the conclusion to ${breakResult.after.winnerLabel}.` : "No reversal found in the bounded search grid."}</h3>
            <p>{breakResult.found ? "This is the nearest flip found across current/default/min/midpoint/max values for every input." : `Closest tested case leaves a decision margin of ${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(breakResult.after.margin)}.`}</p>
          </div>
          <div className="break-changes">
            {changedInputs(model, values, breakResult.values).map((input) => (
              <div key={input.key}><span>{input.label}</span><strong>{inputLabel(input, values[input.key])} → {inputLabel(input, breakResult.values[input.key])}</strong></div>
            ))}
          </div>
          <button onClick={() => applyScenario(breakResult.values)}>Apply scenario</button>
        </div>
      )}

      {calculation.error && <div className="lab-calc-error"><strong>Calculation stopped.</strong><span>{calculation.error}</span></div>}

      {view === "simulator" && (
        <div className="simulator-grid">
          <div className="input-panel">
            <div className="lab-panel-title"><span>Inputs</span><small>Change assumptions</small></div>
            {model.inputs.map((input) => {
              const value = values[input.key] ?? input.default;
              return (
                <label className="model-input" key={input.key}>
                  <div className="model-input-head"><span>{input.label}</span><strong>{inputLabel(input, value)}</strong></div>
                  {input.description && <small>{input.description}</small>}
                  <input type="range" min={input.min} max={input.max} step={input.step} value={value} onChange={(event) => setInput(input.key, Number(event.target.value))} />
                  <div className="model-input-foot"><span>{inputLabel(input, input.min)}</span><input aria-label={`${input.label} numeric value`} type="number" min={input.min} max={input.max} step={input.step} value={value} onChange={(event) => { const next = Number(event.target.value); if (Number.isFinite(next)) setInput(input.key, next); }} /><span>{inputLabel(input, input.max)}</span></div>
                </label>
              );
            })}
          </div>
          <div className="output-panel">
            <div className="lab-panel-title"><span>Live outputs</span><small>Recomputed locally</small></div>
            {calculation.decision && <DecisionCard model={model} snapshot={calculation.decision} />}
            <div className="model-output-grid">
              {calculation.scope && model.outputs.map((output) => (
                <div className={`model-output output-${output.emphasis ?? "secondary"}`} key={output.key}>
                  <span>{output.label}</span>
                  <strong>{formatValue(calculation.scope![output.key], output.format, output.unit)}</strong>
                  {output.detail && <small>{output.detail}</small>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {view === "timeline" && <ModelChart model={model} prepared={prepared} values={values} />}

      {view === "sensitivity" && (
        <div className="sensitivity-panel">
          <div className="lab-panel-title"><span>What actually matters?</span><small>One-at-a-time full-range swing in {target}</small></div>
          <div className="sensitivity-list">
            {calculation.sensitivities.map((item, index) => (
              <div className="sensitivity-row" key={item.key}>
                <div className="sensitivity-rank">{index + 1}</div>
                <div className="sensitivity-main">
                  <div><strong>{item.label}</strong><span>{new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(item.low)} → {new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(item.high)}</span></div>
                  <div className="sensitivity-track"><i style={{ width: `${Math.max(2, (item.swing / maxSwing) * 100)}%` }} /></div>
                </div>
                <strong className="sensitivity-swing">Δ {new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(item.swing)}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "boundary" && boundaryAvailable && (
        <DecisionBoundary
          model={model}
          prepared={prepared}
          values={values}
          sensitivities={calculation.sensitivities}
          onValuesChange={updateBoundaryScenario}
        />
      )}

      {view === "logic" && (
        <div className="logic-panel">
          <div className="lab-panel-title"><span>Model logic</span><small>Inspectable, deterministic expressions</small></div>
          <div className="formula-list">
            {model.formulas.map((formula) => (
              <div className="formula-card" key={formula.key}>
                <div><span>{formula.label}</span>{calculation.scope && <strong>{formatValue(calculation.scope[formula.key], formula.format, formula.unit)}</strong>}</div>
                <code>{formula.key} = {formula.expression}</code>
                <small>Depends on: {(prepared.dependencies.get(formula.key) ?? []).join(", ") || "constants only"}</small>
              </div>
            ))}
          </div>
          {model.assumptions.length > 0 && <div className="assumption-list"><strong>Declared assumptions</strong>{model.assumptions.map((assumption) => <p key={assumption}>{assumption}</p>)}</div>}
          <div className="allowed-functions">Allowed formula functions: <code>min max abs floor ceil sqrt log exp pow round clamp monthly_payment loan_balance compound annuity</code></div>
        </div>
      )}
    </section>
  );
}
