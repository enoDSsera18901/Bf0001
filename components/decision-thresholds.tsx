"use client";

import { useMemo } from "react";
import { decisionThresholds } from "@/lib/decision-threshold";
import type { PreparedModel } from "@/lib/model-engine";
import type { ModelInput, RealityModel as RealityModelSpec, ValueFormat } from "@/lib/surface";

function currencyCode(unit?: string): string {
  return unit && /^[A-Z]{3}$/.test(unit) ? unit : "AUD";
}

function formatInput(input: ModelInput, value: number): string {
  const format: ValueFormat | undefined = input.format;
  if (format === "currency") {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currencyCode(input.unit),
      maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
    }).format(value);
  }
  if (format === "percent") return new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 2 }).format(value);
  if (format === "compact") return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 2 }).format(value);
  const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(value);
  return input.unit ? `${number} ${input.unit}` : number;
}

function direction(delta: number): string {
  if (Math.abs(delta) < 1e-9) return "at";
  return delta > 0 ? "increase to" : "decrease to";
}

export function DecisionThresholds({
  model,
  prepared,
  values,
  onValuesChange,
}: {
  model: RealityModelSpec;
  prepared: PreparedModel;
  values: Record<string, number>;
  onValuesChange: (values: Record<string, number>) => void;
}) {
  const state = useMemo(() => {
    try {
      return { results: decisionThresholds(prepared, values), error: null as string | null };
    } catch (cause) {
      return { results: null, error: cause instanceof Error ? cause.message : "Threshold analysis failed." };
    }
  }, [prepared, values]);

  if (!model.decision) return <div className="lab-empty">Thresholds need a declared two-sided decision.</div>;
  if (state.error || !state.results) return <div className="lab-calc-error"><strong>Threshold analysis stopped.</strong><span>{state.error}</span></div>;

  const reachable = state.results.filter((result) => result.found).length;
  const currentWinner = state.results[0]?.before.winnerLabel ?? "—";

  return (
    <div className="threshold-panel">
      <div className="threshold-heading">
        <div>
          <span className="section-kicker">What would it take?</span>
          <h3>Single-assumption flip thresholds</h3>
          <p>Move one assumption at a time while everything else stays fixed. Crossings are refined numerically after a bounded scan.</p>
        </div>
        <div className="threshold-summary">
          <span>Current winner</span>
          <strong>{currentWinner}</strong>
          <small>{reachable}/{model.inputs.length} assumptions can reverse it alone</small>
        </div>
      </div>

      <div className="threshold-list">
        {state.results.map((result, index) => (
          <div className={`threshold-row${result.found ? " threshold-found" : ""}`} key={result.input.key}>
            <div className="threshold-rank">{index + 1}</div>
            <div className="threshold-main">
              <div className="threshold-name">
                <strong>{result.input.label}</strong>
                {result.found && result.after && <span>→ {result.after.winnerLabel}</span>}
              </div>
              {result.found && result.boundaryValue !== null && result.delta !== null ? (
                <>
                  <div className="threshold-values">
                    <span>{formatInput(result.input, result.current)}</span>
                    <i>{direction(result.delta)}</i>
                    <strong>≈ {formatInput(result.input, result.boundaryValue)}</strong>
                  </div>
                  <div className="threshold-distance"><i style={{ width: `${Math.max(2, Math.min(100, (result.distance ?? 0) * 100))}%` }} /></div>
                  <small>{new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format((result.distance ?? 0) * 100)}% of this assumption&apos;s declared range away from the current value.</small>
                </>
              ) : (
                <div className="threshold-unreachable">No single-variable reversal found inside {formatInput(result.input, result.input.min)} – {formatInput(result.input, result.input.max)}.</div>
              )}
            </div>
            <button
              className="threshold-apply"
              type="button"
              disabled={!result.found || result.applyValue === null}
              onClick={() => result.applyValue !== null && onValuesChange({ ...values, [result.input.key]: result.applyValue })}
            >
              Apply
            </button>
          </div>
        ))}
      </div>

      <div className="threshold-footnote">
        A threshold is a one-dimensional local counterfactual, not a guarantee that changing this assumption is realistic or independent of the others.
      </div>
    </div>
  );
}
