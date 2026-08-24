import type { CriticalIssue, NumericFact } from "../../contracts/evaluation-result.js";
import { sensorThresholds } from "../../scoring/scoring.config.js";
import { normalizeForComparison, normalizeText, tokenize } from "../../tools/normalize-document.js";
import { rougeL } from "../text-similarity/rouge.js";
import { normalizeUnit, unitsEqual } from "./units.js";

const unitPattern = "(?:mg|g|kg|mL|ml|L|µL|uL|µm|um|nm|ppm|rpm|min|minutes?|seconds?|sec|°C|C|%|cm-1|µg/mL|ug/mL|mL/min|ml/min|cfu/g|tablets?)";
const numberPattern = /(?<comparator><=|>=|≤|≥|<|>)?\s*(?<value>\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:±\s*(?<tolerance>\d+(?:\.\d+)?))?\s*(?<unit>mg|g|kg|mL|ml|L|µL|uL|µm|um|nm|ppm|rpm|min|minutes?|seconds?|sec|°C|C|%|cm-1|µg\/mL|ug\/mL|mL\/min|ml\/min|cfu\/g|tablets?)?/giu;

function normalizeComparator(comparator?: string): NumericFact["comparator"] {
  if (!comparator) return "=";
  if (comparator === "≤") return "<=";
  if (comparator === "≥") return ">=";
  return comparator as NumericFact["comparator"];
}

function contextAround(text: string, start: number, end: number): string {
  return normalizeForComparison(`${text.slice(Math.max(0, start - 48), start)} ${text.slice(end, Math.min(text.length, end + 48))}`);
}

export function extractNumericFacts(input: string): NumericFact[] {
  const text = normalizeText(input);
  const facts: NumericFact[] = [];
  for (const match of text.matchAll(numberPattern)) {
    const valueText = match.groups?.value;
    if (!valueText) continue;
    const raw = match[0].trim();
    facts.push({
      raw,
      value: Number(valueText.replace(/,/g, "")),
      comparator: normalizeComparator(match.groups?.comparator),
      tolerance: match.groups?.tolerance ? Number(match.groups.tolerance) : undefined,
      unit: normalizeUnit(match.groups?.unit),
      context: contextAround(text, match.index ?? 0, (match.index ?? 0) + raw.length)
    });
  }
  return facts;
}

function contextSimilarity(left: NumericFact, right: NumericFact): number {
  return rougeL(tokenize(left.context), tokenize(right.context));
}

function sameNumericFact(left: NumericFact, right: NumericFact): boolean {
  return left.value === right.value &&
    left.comparator === right.comparator &&
    (left.tolerance ?? 0) === (right.tolerance ?? 0) &&
    unitsEqual(left.unit, right.unit);
}

export interface NumericFidelityResult {
  referenceFacts: number;
  matched: number;
  missing: NumericFact[];
  changed: Array<{ reference: NumericFact; generated: NumericFact }>;
  extra: NumericFact[];
  score: number;
  criticalIssues: CriticalIssue[];
}

export function numericFidelity(referenceText: string, generatedText: string): NumericFidelityResult {
  const referenceFacts = extractNumericFacts(referenceText);
  const generatedFacts = extractNumericFacts(generatedText);
  const used = new Set<number>();
  const missing: NumericFact[] = [];
  const changed: Array<{ reference: NumericFact; generated: NumericFact }> = [];
  const criticalIssues: CriticalIssue[] = [];
  let matched = 0;

  for (const reference of referenceFacts) {
    let bestIndex = -1;
    let bestScore = -1;
    generatedFacts.forEach((generated, index) => {
      if (used.has(index)) return;
      if (!unitsEqual(reference.unit, generated.unit)) return;
      const score = contextSimilarity(reference, generated);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    if (bestIndex < 0 || bestScore < sensorThresholds.numericContextMatch) {
      missing.push(reference);
      continue;
    }

    const generated = generatedFacts[bestIndex]!;
    used.add(bestIndex);
    if (sameNumericFact(reference, generated)) {
      matched += 1;
      continue;
    }

    changed.push({ reference, generated });
    if (reference.comparator !== generated.comparator) {
      criticalIssues.push({
        type: "changed_comparator",
        severity: "critical",
        message: `Comparator changed near "${reference.raw}" -> "${generated.raw}".`,
        reference,
        generated
      });
    }
    const refValue = Math.abs(reference.value ?? 0);
    const genValue = Math.abs(generated.value ?? 0);
    const relativeChange = refValue === 0 ? Math.abs(genValue - refValue) : Math.abs(genValue - refValue) / refValue;
    if (relativeChange >= sensorThresholds.majorNumericRelativeChange) {
      criticalIssues.push({
        type: "major_numeric_mismatch",
        severity: "critical",
        message: `Numeric value changed materially near "${reference.raw}" -> "${generated.raw}".`,
        reference,
        generated
      });
    }
  }

  const extra = generatedFacts.filter((_, index) => !used.has(index));
  return {
    referenceFacts: referenceFacts.length,
    matched,
    missing,
    changed,
    extra,
    score: referenceFacts.length === 0 ? 1 : matched / referenceFacts.length,
    criticalIssues
  };
}

export function unitFidelity(referenceText: string, generatedText: string) {
  const referenceUnits = extractNumericFacts(referenceText).filter((fact) => fact.unit);
  const generatedFacts = extractNumericFacts(generatedText);
  let matched = 0;
  for (const reference of referenceUnits) {
    if (generatedFacts.some((generated) => reference.value === generated.value && unitsEqual(reference.unit, generated.unit))) {
      matched += 1;
    }
  }
  return {
    referenceUnits: referenceUnits.length,
    matched,
    score: referenceUnits.length === 0 ? 1 : matched / referenceUnits.length
  };
}

export const numericUnitPattern = new RegExp(unitPattern, "i");
