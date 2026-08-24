import test from "node:test";
import assert from "node:assert/strict";
import { characterLevenshtein } from "../sensors/text-similarity/levenshtein.js";
import { headingSimilarity } from "../sensors/structure/sections.js";
import { numericFidelity, unitFidelity } from "../sensors/factual/numbers.js";
import { formulaFidelity, formulasEquivalent } from "../sensors/factual/formulas.js";
import { calculateOverallScore, decide } from "../scoring/scoring-engine.js";
import type { DocumentEvaluationResult } from "../contracts/evaluation-result.js";

test("character Levenshtein returns 100% for identical text", () => {
  const result = characterLevenshtein("same text", "same text");
  assert.equal(result.distance, 0);
  assert.equal(result.normalizedSimilarity, 1);
});

test("character Levenshtein returns low score for completely different text", () => {
  const result = characterLevenshtein("aaaaaa", "zzzzzz");
  assert.ok(result.normalizedSimilarity < 0.1);
});

test("section heading normalization matches dotted headings", () => {
  assert.ok(headingSimilarity("3.7 Dissolution", "3.7. Dissolution") >= 0.99);
});

test("numeric fidelity matches tolerance and degrees formatting", () => {
  const result = numericFidelity("Temperature 37 ± 0.5°C", "Temperature: 37 ± 0.5 °C");
  assert.equal(result.matched, 1);
  assert.equal(result.changed.length, 0);
  assert.equal(result.score, 1);
});

test("numeric fidelity flags materially changed values", () => {
  const result = numericFidelity("Temperature 37 ± 0.5°C", "Temperature 73 ± 0.5°C");
  assert.equal(result.matched, 0);
  assert.equal(result.changed.length, 1);
  assert.ok(result.criticalIssues.some((issue) => issue.type === "major_numeric_mismatch"));
});

test("comparator fidelity catches opposite comparator", () => {
  const result = numericFidelity("Impurity must be ≤ 2.0%", "Impurity must be ≥ 2.0%");
  assert.equal(result.matched, 0);
  assert.equal(result.changed.length, 1);
  assert.ok(result.criticalIssues.some((issue) => issue.type === "changed_comparator"));
});

test("unit fidelity treats minutes and min as equivalent", () => {
  const result = unitFidelity("Dissolution occurs in 30 minutes", "Dissolution occurs in 30 min");
  assert.equal(result.score, 1);
});

test("formula normalization matches equivalent formatting", () => {
  assert.equal(
    formulasEquivalent("% Assay = (As / Ar) × (Cr / Cs) × 100", "% Assay=(As/Ar) x (Cr/Cs) x 100"),
    true
  );
  assert.equal(
    formulaFidelity("% Assay = (As / Ar) × (Cr / Cs) × 100", "% Assay=(As/Ar) x (Cr/Cs) x 100").score,
    1
  );
});

test("overall scoring produces deterministic PASS without critical issues", () => {
  const metrics = {
    characterLevenshtein: { score: 0.9, display: "90.0%" },
    wordLevenshtein: { score: 0.9, display: "90.0%" },
    rouge1: { score: 0.9, display: "90.0%" },
    rouge2: { score: 0.88, display: "88.0%" },
    rougeL: { score: 0.9, display: "90.0%" },
    tfidfCosine: { score: 0.9, display: "90.0%" },
    sectionCoverage: { score: 1, display: "100.0%" },
    headingCoverage: { score: 1, display: "100.0%" },
    sectionOrder: { score: 1, display: "100.0%" },
    numericFidelity: { score: 1, display: "100.0%" },
    unitFidelity: { score: 1, display: "100.0%" },
    formulaFidelity: { score: 1, display: "100.0%" },
    tableFidelity: { score: 0.9, display: "90.0%" },
    completeness: { score: 0.9, display: "90.0%" }
  } satisfies DocumentEvaluationResult["metrics"];
  const score = calculateOverallScore(metrics);
  assert.equal(decide(score, []), "PASS");
});
