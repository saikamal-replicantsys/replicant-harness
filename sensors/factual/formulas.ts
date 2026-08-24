import { normalizeForComparison } from "../../tools/normalize-document.js";

export interface FormulaFidelityResult {
  referenceFormulas: number;
  matched: string[];
  missing: string[];
  changed: Array<{ reference: string; generated: string }>;
  score: number;
}

function normalizeFormula(input: string): string {
  return normalizeForComparison(input)
    .replace(/\bpercent\b/g, "%")
    .replace(/[(){}\[\]]/g, "")
    .replace(/\s*x\s*/g, "*")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s*=\s*/g, "=")
    .replace(/\s+/g, "");
}

export function extractFormulas(input: string): string[] {
  return input
    .split(/\n|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter((line) => line.includes("=") && /[%*/×/()-]/.test(line));
}

export function formulasEquivalent(reference: string, generated: string): boolean {
  return normalizeFormula(reference) === normalizeFormula(generated);
}

export function formulaFidelity(referenceText: string, generatedText: string): FormulaFidelityResult {
  const referenceFormulas = extractFormulas(referenceText);
  const generatedFormulas = extractFormulas(generatedText);
  const used = new Set<number>();
  const matched: string[] = [];
  const missing: string[] = [];
  const changed: Array<{ reference: string; generated: string }> = [];

  for (const reference of referenceFormulas) {
    const exactIndex = generatedFormulas.findIndex((generated, index) => !used.has(index) && formulasEquivalent(reference, generated));
    if (exactIndex >= 0) {
      used.add(exactIndex);
      matched.push(reference);
      continue;
    }
    const sameNameIndex = generatedFormulas.findIndex((generated, index) => !used.has(index) && normalizeFormula(generated).split("=")[0] === normalizeFormula(reference).split("=")[0]);
    if (sameNameIndex >= 0) {
      used.add(sameNameIndex);
      changed.push({ reference, generated: generatedFormulas[sameNameIndex]! });
    } else {
      missing.push(reference);
    }
  }

  return {
    referenceFormulas: referenceFormulas.length,
    matched,
    missing,
    changed,
    score: referenceFormulas.length === 0 ? 1 : matched.length / referenceFormulas.length
  };
}
