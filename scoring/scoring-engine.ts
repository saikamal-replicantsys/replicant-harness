import type { CriticalIssue, DocumentEvaluationResult, EvaluationDecision } from "../contracts/evaluation-result.js";
import { decisionThresholds, scoringWeights } from "./scoring.config.js";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function calculateOverallScore(metrics: DocumentEvaluationResult["metrics"]): number {
  const structuralSimilarity = (metrics.headingCoverage.score + metrics.sectionOrder.score) / 2;
  const textSimilarity = (
    metrics.wordLevenshtein.score +
    metrics.rouge1.score +
    metrics.rougeL.score +
    metrics.tfidfCosine.score
  ) / 4;

  const weighted =
    scoringWeights.sectionCoverage * metrics.sectionCoverage.score +
    scoringWeights.structuralSimilarity * structuralSimilarity +
    scoringWeights.textSimilarity * textSimilarity +
    scoringWeights.numericFidelity * metrics.numericFidelity.score +
    scoringWeights.unitFidelity * metrics.unitFidelity.score +
    scoringWeights.tableFidelity * metrics.tableFidelity.score +
    scoringWeights.completeness * metrics.completeness.score;

  return Math.round(clamp01(weighted) * 1000) / 10;
}

export function decide(score: number, criticalIssues: CriticalIssue[]): EvaluationDecision {
  if (criticalIssues.length > 0 && score >= decisionThresholds.pass) return "REVIEW";
  if (score >= decisionThresholds.pass) return "PASS";
  if (score >= decisionThresholds.review) return "REVIEW";
  return "FAIL";
}
