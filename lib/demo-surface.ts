import type { SurfaceSpec } from "./surface";

export const demoSurface: SurfaceSpec = {
  title: "Should this $40 product launch?",
  subtitle: "A deterministic Reality Lab demo — no model call required. Change the assumptions, stress it, then try to break the conclusion.",
  model: {
    title: "Small product launch",
    description: "Monthly unit economics for a hypothetical product. The current decision compares monthly operating profit with the zero-profit option of not launching.",
    inputs: [
      { key: "price", label: "Selling price", description: "Customer price per unit.", min: 25, max: 60, step: 1, default: 40, format: "currency", unit: "AUD" },
      { key: "unit_cost", label: "Unit cost", description: "Manufacturing, packaging and fulfilment per unit.", min: 5, max: 30, step: 1, default: 14, format: "currency", unit: "AUD" },
      { key: "volume", label: "Monthly units", description: "Units sold per month.", min: 100, max: 2000, step: 50, default: 600, format: "number" },
      { key: "fixed_cost", label: "Fixed monthly cost", description: "Software, storage, insurance and other fixed overhead.", min: 2000, max: 20000, step: 500, default: 8000, format: "currency", unit: "AUD" },
      { key: "ad_spend", label: "Monthly ad spend", description: "Paid acquisition budget.", min: 0, max: 10000, step: 250, default: 3000, format: "currency", unit: "AUD" },
    ],
    formulas: [
      { key: "contribution", label: "Contribution per unit", expression: "price - unit_cost", format: "currency", unit: "AUD" },
      { key: "revenue", label: "Monthly revenue", expression: "price * volume", format: "currency", unit: "AUD" },
      { key: "variable_cost", label: "Variable cost", expression: "unit_cost * volume", format: "currency", unit: "AUD" },
      { key: "profit", label: "Monthly operating profit", expression: "revenue - variable_cost - fixed_cost - ad_spend", format: "currency", unit: "AUD" },
      { key: "break_even_units", label: "Break-even units", expression: "(fixed_cost + ad_spend) / max(0.01, contribution)", format: "number", unit: "units" },
      { key: "profit_margin", label: "Operating margin", expression: "profit / max(1, revenue)", format: "percent" },
      { key: "dont_launch", label: "Do not launch baseline", expression: "0", format: "currency", unit: "AUD" },
    ],
    outputs: [
      { key: "profit", label: "Monthly operating profit", detail: "Revenue less unit, fixed and advertising costs.", format: "currency", unit: "AUD", emphasis: "primary" },
      { key: "revenue", label: "Monthly revenue", format: "currency", unit: "AUD" },
      { key: "break_even_units", label: "Break-even volume", format: "number", unit: "units" },
      { key: "profit_margin", label: "Operating margin", format: "percent" },
    ],
    series: [
      { key: "profit_curve", label: "Profit by monthly units", expression: "price * t - unit_cost * t - fixed_cost - ad_spend", from: 100, to: 2000, step: 100, format: "currency", unit: "AUD" },
    ],
    stressTests: [
      { label: "Demand shock", rationale: "Sales fall well below the current plan.", changes: [{ key: "volume", value: 250 }] },
      { label: "Cost squeeze", rationale: "Unit economics deteriorate while acquisition spending rises.", changes: [{ key: "unit_cost", value: 24 }, { key: "ad_spend", value: 6000 }] },
      { label: "Price pressure", rationale: "Competition forces a lower selling price.", changes: [{ key: "price", value: 30 }] },
    ],
    decision: {
      leftKey: "profit",
      leftLabel: "Launch",
      rightKey: "dont_launch",
      rightLabel: "Do not launch",
      objective: "higher",
    },
    assumptions: [
      "This is a deliberately simple monthly operating model, not a valuation.",
      "Taxes, refunds, working capital, inventory timing and owner labour are excluded.",
      "Advertising spend is treated as a fixed monthly amount rather than modelling customer acquisition dynamics.",
      "All numbers are hypothetical and exist only to prove the deterministic interaction loop.",
    ],
  },
  blocks: [
    {
      type: "note",
      tone: "info",
      title: "This one is not generated",
      body: "The numbers and formulas on this demo surface are committed in the repository. It exists so Simulator, Morph, Stress Test and Break This can be exercised without an AI connection.",
    },
  ],
  followUps: [],
};
