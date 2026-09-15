"use client";

import { useMemo, useState } from "react";
import { decisionBoundary, nearestBoundaryCell } from "@/lib/decision-boundary";
import type { PreparedModel, SensitivityItem } from "@/lib/model-engine";
import type { ModelInput, RealityModel as RealityModelSpec, ValueFormat } from "@/lib/surface";

function currencyCode(unit?: string): string {
  return unit && /^[A-Z]{3}$/.test(unit) ? unit : "AUD";
}

function formatAxisValue(value: number, format?: ValueFormat, unit?: string): string {
  if (format === "currency") {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: currencyCode(unit),
      maximumFractionDigits: Math.abs(value) < 100 ? 2 : 0,
    }).format(value);
  }
  if (format === "percent") return new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 1 }).format(value);
  if (format === "compact") return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const formatted = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

function initialAxes(model: RealityModelSpec, sensitivities: SensitivityItem[]): [string, string] {
  const ranked = sensitivities.map((item) => item.key).filter((key, index, all) => all.indexOf(key) === index);
  const fallback = model.inputs.map((input) => input.key);
  const keys = [...ranked, ...fallback].filter((key, index, all) => all.indexOf(key) === index);
  return [keys[0] ?? "", keys[1] ?? ""];
}

function otherAxis(model: RealityModelSpec, forbidden: string, preferred?: string): string {
  if (preferred && preferred !== forbidden && model.inputs.some((input) => input.key === preferred)) return preferred;
  return model.inputs.find((input) => input.key !== forbidden)?.key ?? forbidden;
}

function inputFor(model: RealityModelSpec, key: string): ModelInput | undefined {
  return model.inputs.find((input) => input.key === key);
}

export function DecisionBoundary({
  model,
  prepared,
  values,
  sensitivities,
  onValuesChange,
}: {
  model: RealityModelSpec;
  prepared: PreparedModel;
  values: Record<string, number>;
  sensitivities: SensitivityItem[];
  onValuesChange: (values: Record<string, number>) => void;
}) {
  const [initialX, initialY] = initialAxes(model, sensitivities);
  const [xKey, setXKey] = useState(initialX);
  const [yKey, setYKey] = useState(initialY);

  const state = useMemo(() => {
    try {
      const result = decisionBoundary(prepared, values, xKey, yKey, 15);
      return { result, error: null as string | null };
    } catch (cause) {
      return { result: null, error: cause instanceof Error ? cause.message : "Boundary calculation failed." };
    }
  }, [prepared, values, xKey, yKey]);

  if (!model.decision || model.inputs.length < 2) {
    return <div className="lab-empty">Decision Boundary needs a two-sided decision and at least two inputs.</div>;
  }

  const result = state.result;
  if (!result) {
    return <div className="lab-calc-error"><strong>Boundary stopped.</strong><span>{state.error}</span></div>;
  }

  const nearest = nearestBoundaryCell(result, values);
  const leftCount = result.cells.filter((cell) => cell.snapshot.winner === "left").length;
  const rightCount = result.cells.filter((cell) => cell.snapshot.winner === "right").length;
  const tieCount = result.cells.length - leftCount - rightCount;
  const xInput = inputFor(model, xKey)!;
  const yInput = inputFor(model, yKey)!;
  const decision = model.decision;

  const chooseX = (next: string) => {
    if (next === yKey) setYKey(otherAxis(model, next, xKey));
    setXKey(next);
  };

  const chooseY = (next: string) => {
    if (next === xKey) setXKey(otherAxis(model, next, yKey));
    setYKey(next);
  };

  return (
    <div className="boundary-panel">
      <div className="lab-panel-title boundary-title">
        <div>
          <span>Decision boundary</span>
          <small>Map where the winner changes while all other assumptions stay at their current values.</small>
        </div>
        <div className="boundary-axis-pickers">
          <label>
            <span>X axis</span>
            <select value={xKey} onChange={(event) => chooseX(event.target.value)}>
              {model.inputs.map((input) => <option key={input.key} value={input.key}>{input.label}</option>)}
            </select>
          </label>
          <label>
            <span>Y axis</span>
            <select value={yKey} onChange={(event) => chooseY(event.target.value)}>
              {model.inputs.map((input) => <option key={input.key} value={input.key}>{input.label}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="boundary-layout">
        <div className="boundary-y-axis">
          <strong>{yInput.label}</strong>
          <span>{formatAxisValue(yInput.max, yInput.format, yInput.unit)}</span>
          <i />
          <span>{formatAxisValue(yInput.min, yInput.format, yInput.unit)}</span>
        </div>

        <div>
          <div className="boundary-grid" style={{ gridTemplateColumns: `repeat(${result.steps}, minmax(0, 1fr))` }}>
            {result.cells.map((cell) => {
              const intensity = Math.min(1, Math.abs(cell.snapshot.margin) / result.maxAbsMargin);
              const isCurrent = nearest?.row === cell.row && nearest.column === cell.column;
              return (
                <button
                  type="button"
                  key={`${cell.row}-${cell.column}`}
                  className={`boundary-cell winner-${cell.snapshot.winner}${isCurrent ? " boundary-current" : ""}`}
                  style={{ opacity: 0.35 + intensity * 0.65 }}
                  aria-label={`${xInput.label} ${formatAxisValue(cell.x, xInput.format, xInput.unit)}, ${yInput.label} ${formatAxisValue(cell.y, yInput.format, yInput.unit)}: ${cell.snapshot.winnerLabel}`}
                  title={`${cell.snapshot.winnerLabel} · margin ${new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(cell.snapshot.margin)}`}
                  onClick={() => onValuesChange({ ...values, [xKey]: cell.x, [yKey]: cell.y })}
                />
              );
            })}
          </div>
          <div className="boundary-x-axis">
            <span>{formatAxisValue(xInput.min, xInput.format, xInput.unit)}</span>
            <strong>{xInput.label}</strong>
            <span>{formatAxisValue(xInput.max, xInput.format, xInput.unit)}</span>
          </div>
        </div>

        <aside className="boundary-legend">
          <div className="boundary-legend-item"><i className="winner-left" /><span>{decision.leftLabel}</span><strong>{leftCount}</strong></div>
          <div className="boundary-legend-item"><i className="winner-right" /><span>{decision.rightLabel}</span><strong>{rightCount}</strong></div>
          {tieCount > 0 && <div className="boundary-legend-item"><i className="winner-tie" /><span>Tie</span><strong>{tieCount}</strong></div>}
          <p><strong>225</strong> bounded scenarios. Click any cell to apply its two axis values to the live model.</p>
          <p className="boundary-caveat">This is a finite grid, not proof of the continuous global boundary.</p>
        </aside>
      </div>
    </div>
  );
}
