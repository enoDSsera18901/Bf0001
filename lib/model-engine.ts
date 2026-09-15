import jsep from "jsep";
import jsepTernary from "@jsep-plugin/ternary";
import type { ModelInput, RealityModel } from "./surface";

jsep.plugins.register(jsepTernary);

type AstNode = {
  type: string;
  operator?: string;
  name?: string;
  value?: unknown;
  left?: AstNode;
  right?: AstNode;
  argument?: AstNode;
  test?: AstNode;
  consequent?: AstNode;
  alternate?: AstNode;
  callee?: AstNode;
  arguments?: AstNode[];
};

type Scalar = number | boolean;
type Scope = Record<string, Scalar>;

type CompiledFormula = {
  key: string;
  ast: AstNode;
  dependencies: string[];
};

type CompiledSeries = {
  key: string;
  ast: AstNode;
};

export type PreparedModel = {
  model: RealityModel;
  formulaOrder: string[];
  formulas: Map<string, CompiledFormula>;
  series: Map<string, CompiledSeries>;
  dependencies: Map<string, string[]>;
};

export type DecisionSnapshot = {
  left: number;
  right: number;
  margin: number;
  winner: "left" | "right" | "tie";
  winnerLabel: string;
};

export type SensitivityItem = {
  key: string;
  label: string;
  low: number;
  high: number;
  swing: number;
  base: number;
};

export type BreakSearchResult = {
  found: boolean;
  values: Record<string, number>;
  before: DecisionSnapshot;
  after: DecisionSnapshot;
  distance: number;
};

export type DecisionExtremes = {
  worst: { values: Record<string, number>; snapshot: DecisionSnapshot };
  best: { values: Record<string, number>; snapshot: DecisionSnapshot };
};

const EPSILON = 1e-9;
const MAX_BREAK_COMBINATIONS = 20000;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} produced a non-finite value.`);
  return value;
}

function arg(args: number[], index: number, fn: string): number {
  const value = args[index];
  if (value === undefined) throw new Error(`${fn} requires argument ${index + 1}.`);
  return value;
}

function payment(principal: number, annualRate: number, years: number, periodsPerYear = 12): number {
  if (principal < 0 || years <= 0 || periodsPerYear <= 0) throw new Error("monthly_payment received an invalid loan term.");
  const periods = years * periodsPerYear;
  const rate = annualRate / periodsPerYear;
  if (Math.abs(rate) < EPSILON) return principal / periods;
  return principal * rate / (1 - Math.pow(1 + rate, -periods));
}

const FUNCTIONS: Record<string, (args: number[]) => number> = {
  min: (args) => Math.min(...args),
  max: (args) => Math.max(...args),
  abs: (args) => Math.abs(arg(args, 0, "abs")),
  floor: (args) => Math.floor(arg(args, 0, "floor")),
  ceil: (args) => Math.ceil(arg(args, 0, "ceil")),
  sqrt: (args) => Math.sqrt(arg(args, 0, "sqrt")),
  log: (args) => Math.log(arg(args, 0, "log")),
  exp: (args) => Math.exp(arg(args, 0, "exp")),
  pow: (args) => Math.pow(arg(args, 0, "pow"), arg(args, 1, "pow")),
  round: (args) => {
    const value = arg(args, 0, "round");
    const digits = args[1] ?? 0;
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
  },
  clamp: (args) => {
    const value = arg(args, 0, "clamp");
    const min = arg(args, 1, "clamp");
    const max = arg(args, 2, "clamp");
    return Math.min(max, Math.max(min, value));
  },
  monthly_payment: (args) => payment(arg(args, 0, "monthly_payment"), arg(args, 1, "monthly_payment"), arg(args, 2, "monthly_payment"), args[3] ?? 12),
  loan_balance: (args) => {
    const principal = arg(args, 0, "loan_balance");
    const annualRate = arg(args, 1, "loan_balance");
    const years = arg(args, 2, "loan_balance");
    const elapsedYears = arg(args, 3, "loan_balance");
    const periodsPerYear = args[4] ?? 12;
    const totalPeriods = years * periodsPerYear;
    const elapsedPeriods = Math.max(0, Math.min(totalPeriods, elapsedYears * periodsPerYear));
    const rate = annualRate / periodsPerYear;
    const pmt = payment(principal, annualRate, years, periodsPerYear);
    if (Math.abs(rate) < EPSILON) return Math.max(0, principal - pmt * elapsedPeriods);
    const growth = Math.pow(1 + rate, elapsedPeriods);
    return Math.max(0, principal * growth - pmt * ((growth - 1) / rate));
  },
  compound: (args) => {
    const principal = arg(args, 0, "compound");
    const annualRate = arg(args, 1, "compound");
    const years = arg(args, 2, "compound");
    const periodsPerYear = args[3] ?? 1;
    return principal * Math.pow(1 + annualRate / periodsPerYear, years * periodsPerYear);
  },
  annuity: (args) => {
    const contribution = arg(args, 0, "annuity");
    const annualRate = arg(args, 1, "annuity");
    const years = arg(args, 2, "annuity");
    const periodsPerYear = args[3] ?? 12;
    const periods = years * periodsPerYear;
    const rate = annualRate / periodsPerYear;
    if (Math.abs(rate) < EPSILON) return contribution * periods;
    return contribution * ((Math.pow(1 + rate, periods) - 1) / rate);
  },
};

function asNumber(value: Scalar, label: string): number {
  if (typeof value !== "number") throw new Error(`${label} must be numeric.`);
  return finite(value, label);
}

function asBoolean(value: Scalar): boolean {
  return typeof value === "boolean" ? value : Math.abs(value) > EPSILON;
}

function binary(operator: string, left: Scalar, right: Scalar): Scalar {
  switch (operator) {
    case "+": return finite(asNumber(left, "+") + asNumber(right, "+"), "+");
    case "-": return finite(asNumber(left, "-") - asNumber(right, "-"), "-");
    case "*": return finite(asNumber(left, "*") * asNumber(right, "*"), "*");
    case "/": return finite(asNumber(left, "/") / asNumber(right, "/"), "/");
    case "%": return finite(asNumber(left, "%") % asNumber(right, "%"), "%");
    case "**": return finite(Math.pow(asNumber(left, "**"), asNumber(right, "**")), "**");
    case "<": return asNumber(left, "<") < asNumber(right, "<");
    case "<=": return asNumber(left, "<=") <= asNumber(right, "<=");
    case ">": return asNumber(left, ">") > asNumber(right, ">");
    case ">=": return asNumber(left, ">=") >= asNumber(right, ">");
    case "==":
    case "===": return left === right;
    case "!=":
    case "!==": return left !== right;
    case "&&": return asBoolean(left) && asBoolean(right);
    case "||": return asBoolean(left) || asBoolean(right);
    default: throw new Error(`Operator ${operator} is not allowed.`);
  }
}

function evaluateNode(node: AstNode, scope: Scope): Scalar {
  switch (node.type) {
    case "Literal": {
      if (typeof node.value === "number" || typeof node.value === "boolean") return node.value;
      throw new Error("Only numeric and boolean literals are allowed.");
    }
    case "Identifier": {
      const name = node.name ?? "";
      if (name === "true") return true;
      if (name === "false") return false;
      if (!(name in scope)) throw new Error(`Unknown variable ${name}.`);
      return scope[name];
    }
    case "UnaryExpression": {
      if (!node.argument || !node.operator) throw new Error("Malformed unary expression.");
      const value = evaluateNode(node.argument, scope);
      if (node.operator === "-") return -asNumber(value, "unary -");
      if (node.operator === "+") return asNumber(value, "unary +");
      if (node.operator === "!") return !asBoolean(value);
      throw new Error(`Unary operator ${node.operator} is not allowed.`);
    }
    case "BinaryExpression": {
      if (!node.left || !node.right || !node.operator) throw new Error("Malformed binary expression.");
      if (node.operator === "&&") {
        const left = evaluateNode(node.left, scope);
        return asBoolean(left) ? asBoolean(evaluateNode(node.right, scope)) : false;
      }
      if (node.operator === "||") {
        const left = evaluateNode(node.left, scope);
        return asBoolean(left) ? true : asBoolean(evaluateNode(node.right, scope));
      }
      return binary(node.operator, evaluateNode(node.left, scope), evaluateNode(node.right, scope));
    }
    case "ConditionalExpression": {
      if (!node.test || !node.consequent || !node.alternate) throw new Error("Malformed conditional expression.");
      return asBoolean(evaluateNode(node.test, scope))
        ? evaluateNode(node.consequent, scope)
        : evaluateNode(node.alternate, scope);
    }
    case "CallExpression": {
      if (!node.callee || node.callee.type !== "Identifier") throw new Error("Only direct calls to approved functions are allowed.");
      const name = node.callee.name ?? "";
      const fn = FUNCTIONS[name];
      if (!fn) throw new Error(`Function ${name} is not allowed.`);
      const args = (node.arguments ?? []).map((argument) => asNumber(evaluateNode(argument, scope), `${name} argument`));
      return finite(fn(args), name);
    }
    default:
      throw new Error(`Expression node ${node.type} is not allowed.`);
  }
}

function collectIdentifiers(node: AstNode, output: Set<string>): void {
  switch (node.type) {
    case "Literal":
      if (typeof node.value !== "number" && typeof node.value !== "boolean") throw new Error("Only numeric and boolean literals are allowed.");
      return;
    case "Identifier":
      if (node.name && node.name !== "true" && node.name !== "false") output.add(node.name);
      return;
    case "UnaryExpression":
      if (!node.argument) throw new Error("Malformed unary expression.");
      collectIdentifiers(node.argument, output);
      return;
    case "BinaryExpression":
      if (!node.left || !node.right) throw new Error("Malformed binary expression.");
      collectIdentifiers(node.left, output);
      collectIdentifiers(node.right, output);
      return;
    case "ConditionalExpression":
      if (!node.test || !node.consequent || !node.alternate) throw new Error("Malformed conditional expression.");
      collectIdentifiers(node.test, output);
      collectIdentifiers(node.consequent, output);
      collectIdentifiers(node.alternate, output);
      return;
    case "CallExpression": {
      if (!node.callee || node.callee.type !== "Identifier") throw new Error("Only direct calls to approved functions are allowed.");
      const functionName = node.callee.name ?? "";
      if (!FUNCTIONS[functionName]) throw new Error(`Function ${functionName} is not allowed.`);
      for (const argument of node.arguments ?? []) collectIdentifiers(argument, output);
      return;
    }
    default:
      throw new Error(`Expression node ${node.type} is not allowed.`);
  }
}

function parseSafe(expression: string): { ast: AstNode; identifiers: string[] } {
  const ast = jsep(expression) as unknown as AstNode;
  const identifiers = new Set<string>();
  collectIdentifiers(ast, identifiers);
  return { ast, identifiers: [...identifiers] };
}

function uniqueKeys(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const key of values) {
    if (seen.has(key)) throw new Error(`Duplicate ${label} key: ${key}.`);
    seen.add(key);
  }
}

function assertInput(input: ModelInput): void {
  if (!(input.min < input.max)) throw new Error(`${input.label}: min must be lower than max.`);
  if (input.default < input.min || input.default > input.max) throw new Error(`${input.label}: default must be inside its range.`);
  if (input.step <= 0 || input.step > input.max - input.min) throw new Error(`${input.label}: invalid step.`);
}

export function prepareModel(model: RealityModel): PreparedModel {
  const inputKeys = model.inputs.map((input) => input.key);
  const formulaKeys = model.formulas.map((formula) => formula.key);
  uniqueKeys(inputKeys, "input");
  uniqueKeys(formulaKeys, "formula");
  uniqueKeys([...inputKeys, ...formulaKeys], "model");
  model.inputs.forEach(assertInput);

  const allowed = new Set([...inputKeys, ...formulaKeys]);
  const formulaSet = new Set(formulaKeys);
  const formulas = new Map<string, CompiledFormula>();
  const dependencies = new Map<string, string[]>();

  for (const formula of model.formulas) {
    const parsed = parseSafe(formula.expression);
    const unknown = parsed.identifiers.filter((key) => !allowed.has(key));
    if (unknown.length) throw new Error(`${formula.label}: unknown variable(s) ${unknown.join(", ")}.`);
    const formulaDependencies = parsed.identifiers.filter((key) => formulaSet.has(key));
    formulas.set(formula.key, { key: formula.key, ast: parsed.ast, dependencies: formulaDependencies });
    dependencies.set(formula.key, parsed.identifiers);
  }

  const state = new Map<string, 0 | 1 | 2>();
  const formulaOrder: string[] = [];
  const visit = (key: string, trail: string[]) => {
    const current = state.get(key) ?? 0;
    if (current === 2) return;
    if (current === 1) throw new Error(`Formula cycle detected: ${[...trail, key].join(" → ")}.`);
    state.set(key, 1);
    const formula = formulas.get(key);
    if (!formula) throw new Error(`Missing formula ${key}.`);
    for (const dependency of formula.dependencies) visit(dependency, [...trail, key]);
    state.set(key, 2);
    formulaOrder.push(key);
  };
  formulaKeys.forEach((key) => visit(key, []));

  for (const output of model.outputs) {
    if (!allowed.has(output.key)) throw new Error(`Output ${output.label} references unknown key ${output.key}.`);
  }

  if (model.decision) {
    if (!allowed.has(model.decision.leftKey) || !allowed.has(model.decision.rightKey)) {
      throw new Error("Decision rule references an unknown model key.");
    }
  }

  const inputSet = new Set(inputKeys);
  for (const stress of model.stressTests) {
    for (const change of stress.changes) {
      if (!inputSet.has(change.key)) throw new Error(`Stress test ${stress.label} changes unknown input ${change.key}.`);
      const input = model.inputs.find((candidate) => candidate.key === change.key)!;
      if (change.value < input.min || change.value > input.max) throw new Error(`Stress test ${stress.label} puts ${input.label} outside its declared range.`);
    }
  }

  const series = new Map<string, CompiledSeries>();
  for (const item of model.series) {
    if (item.to < item.from) throw new Error(`${item.label}: series end must be after its start.`);
    const pointCount = Math.floor((item.to - item.from) / item.step) + 1;
    if (pointCount < 2 || pointCount > 80) throw new Error(`${item.label}: series must contain 2–80 points.`);
    const parsed = parseSafe(item.expression);
    const unknown = parsed.identifiers.filter((key) => key !== "t" && !allowed.has(key));
    if (unknown.length) throw new Error(`${item.label}: unknown variable(s) ${unknown.join(", ")}.`);
    series.set(item.key, { key: item.key, ast: parsed.ast });
  }

  return { model, formulaOrder, formulas, series, dependencies };
}

export function defaultValues(model: RealityModel): Record<string, number> {
  return Object.fromEntries(model.inputs.map((input) => [input.key, input.default]));
}

export function clampValues(model: RealityModel, values: Record<string, number>): Record<string, number> {
  return Object.fromEntries(model.inputs.map((input) => {
    const candidate = values[input.key];
    const value = Number.isFinite(candidate) ? candidate : input.default;
    return [input.key, Math.min(input.max, Math.max(input.min, value))];
  }));
}

export function evaluatePrepared(prepared: PreparedModel, values: Record<string, number>): Record<string, number> {
  const safeValues = clampValues(prepared.model, values);
  const scope: Scope = { ...safeValues };
  for (const key of prepared.formulaOrder) {
    const formula = prepared.formulas.get(key)!;
    scope[key] = asNumber(evaluateNode(formula.ast, scope), key);
  }
  return Object.fromEntries(Object.entries(scope).map(([key, value]) => [key, asNumber(value, key)]));
}

export function evaluateSeries(prepared: PreparedModel, values: Record<string, number>): Record<string, Array<{ t: number; value: number }>> {
  const base = evaluatePrepared(prepared, values);
  const result: Record<string, Array<{ t: number; value: number }>> = {};
  for (const item of prepared.model.series) {
    const compiled = prepared.series.get(item.key)!;
    const points: Array<{ t: number; value: number }> = [];
    const count = Math.floor((item.to - item.from) / item.step) + 1;
    for (let index = 0; index < count; index += 1) {
      const t = item.from + item.step * index;
      const value = asNumber(evaluateNode(compiled.ast, { ...base, t }), item.label);
      points.push({ t, value });
    }
    result[item.key] = points;
  }
  return result;
}

function probeSignature(model: RealityModel, values: Record<string, number>): string {
  return model.inputs.map((input) => `${input.key}:${Number(values[input.key]).toPrecision(12)}`).join("|");
}

export function validatePreparedDomain(prepared: PreparedModel): void {
  const model = prepared.model;
  const defaults = defaultValues(model);
  const probes = new Map<string, { label: string; values: Record<string, number> }>();
  const addProbe = (label: string, values: Record<string, number>) => {
    const clamped = clampValues(model, values);
    probes.set(probeSignature(model, clamped), { label, values: clamped });
  };

  addProbe("defaults", defaults);
  for (const input of model.inputs) {
    const midpoint = input.min + (input.max - input.min) / 2;
    addProbe(`${input.label} at minimum`, { ...defaults, [input.key]: input.min });
    addProbe(`${input.label} at midpoint`, { ...defaults, [input.key]: midpoint });
    addProbe(`${input.label} at maximum`, { ...defaults, [input.key]: input.max });
  }

  const corners = (index: number, working: Record<string, number>) => {
    if (index === model.inputs.length) {
      addProbe("input-range corner", working);
      return;
    }
    const input = model.inputs[index];
    corners(index + 1, { ...working, [input.key]: input.min });
    corners(index + 1, { ...working, [input.key]: input.max });
  };
  corners(0, { ...defaults });

  for (const probe of probes.values()) {
    try {
      evaluatePrepared(prepared, probe.values);
      evaluateSeries(prepared, probe.values);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown evaluation failure.";
      throw new Error(`Model is invalid inside its declared domain (${probe.label}): ${reason}`);
    }
  }
}

export function decisionSnapshot(prepared: PreparedModel, values: Record<string, number>): DecisionSnapshot | null {
  const decision = prepared.model.decision;
  if (!decision) return null;
  const scope = evaluatePrepared(prepared, values);
  const left = scope[decision.leftKey];
  const right = scope[decision.rightKey];
  const margin = decision.objective === "higher" ? left - right : right - left;
  const winner = Math.abs(margin) <= EPSILON ? "tie" : margin > 0 ? "left" : "right";
  const winnerLabel = winner === "left" ? decision.leftLabel : winner === "right" ? decision.rightLabel : "Tie";
  return { left, right, margin, winner, winnerLabel };
}

function targetValue(prepared: PreparedModel, values: Record<string, number>): number {
  const decision = decisionSnapshot(prepared, values);
  if (decision) return decision.margin;
  const key = prepared.model.outputs[0]?.key;
  if (!key) throw new Error("Model has no output target.");
  return evaluatePrepared(prepared, values)[key];
}

export function sensitivity(prepared: PreparedModel, values: Record<string, number>): SensitivityItem[] {
  const current = clampValues(prepared.model, values);
  const base = targetValue(prepared, current);
  return prepared.model.inputs.map((input) => {
    const low = targetValue(prepared, { ...current, [input.key]: input.min });
    const high = targetValue(prepared, { ...current, [input.key]: input.max });
    return { key: input.key, label: input.label, low, high, swing: Math.abs(high - low), base };
  }).sort((a, b) => b.swing - a.swing);
}

function normalisedDistance(model: RealityModel, from: Record<string, number>, to: Record<string, number>): number {
  return model.inputs.reduce((total, input) => {
    const range = input.max - input.min;
    return total + Math.abs((to[input.key] - from[input.key]) / range);
  }, 0);
}

function candidates(input: ModelInput, current: number): number[] {
  const midpoint = input.min + (input.max - input.min) / 2;
  return [...new Set([current, input.default, input.min, midpoint, input.max].map((value) => Number(value.toPrecision(12))))];
}

export function findDecisionFlip(prepared: PreparedModel, values: Record<string, number>): BreakSearchResult | null {
  if (!prepared.model.decision) return null;
  const current = clampValues(prepared.model, values);
  const before = decisionSnapshot(prepared, current)!;
  const lists = prepared.model.inputs.map((input) => candidates(input, current[input.key]));
  const combinationCount = lists.reduce((total, list) => total * list.length, 1);
  if (combinationCount > MAX_BREAK_COMBINATIONS) throw new Error("Break search space is too large.");

  let bestFlip: BreakSearchResult | null = null;
  let closest: BreakSearchResult | null = null;

  const walk = (index: number, working: Record<string, number>) => {
    if (index === prepared.model.inputs.length) {
      const after = decisionSnapshot(prepared, working)!;
      const distance = normalisedDistance(prepared.model, current, working);
      const result: BreakSearchResult = { found: false, values: { ...working }, before, after, distance };
      const flipped = before.winner === "tie" ? after.winner !== "tie" : after.winner !== before.winner && after.winner !== "tie";
      if (flipped) {
        result.found = true;
        if (!bestFlip || distance < bestFlip.distance) bestFlip = result;
      }
      if (!closest || Math.abs(after.margin) < Math.abs(closest.after.margin) || (Math.abs(after.margin) === Math.abs(closest.after.margin) && distance < closest.distance)) {
        closest = result;
      }
      return;
    }
    const input = prepared.model.inputs[index];
    for (const value of lists[index]) {
      working[input.key] = value;
      walk(index + 1, working);
    }
  };

  walk(0, { ...current });
  return bestFlip ?? closest;
}

export function findDecisionExtremes(prepared: PreparedModel): DecisionExtremes | null {
  if (!prepared.model.decision) return null;
  let worst: DecisionExtremes["worst"] | null = null;
  let best: DecisionExtremes["best"] | null = null;

  const walk = (index: number, working: Record<string, number>) => {
    if (index === prepared.model.inputs.length) {
      const snapshot = decisionSnapshot(prepared, working)!;
      const candidate = { values: { ...working }, snapshot };
      if (!worst || snapshot.margin < worst.snapshot.margin) worst = candidate;
      if (!best || snapshot.margin > best.snapshot.margin) best = candidate;
      return;
    }
    const input = prepared.model.inputs[index];
    working[input.key] = input.min;
    walk(index + 1, working);
    working[input.key] = input.max;
    walk(index + 1, working);
  };

  walk(0, defaultValues(prepared.model));
  return worst && best ? { worst, best } : null;
}

export function applyStress(prepared: PreparedModel, stressIndex: number): Record<string, number> {
  const stress = prepared.model.stressTests[stressIndex];
  if (!stress) throw new Error("Unknown stress test.");
  const values = defaultValues(prepared.model);
  for (const change of stress.changes) values[change.key] = change.value;
  return clampValues(prepared.model, values);
}
