import type { ExtractedSection } from "./extracted-document.js";

export type EvaluationDecision = "PASS" | "REVIEW" | "FAIL";

export interface MetricResult {
  score: number;
  display: string;
  details?: unknown;
}

export interface NumericFact {
  raw: string;
  value?: number;
  comparator?: "<" | "<=" | ">" | ">=" | "=";
  tolerance?: number;
  unit?: string;
  context: string;
}

export interface FormulaMatch {
  reference: string;
  generated?: string;
}

export interface CriticalIssue {
  type: "changed_comparator" | "major_numeric_mismatch" | "missing_top_level_section";
  severity: "critical";
  message: string;
  reference?: unknown;
  generated?: unknown;
}

export interface SectionAlignment {
  referenceHeading: string;
  generatedHeading?: string;
  referenceSection: ExtractedSection;
  generatedSection?: ExtractedSection;
  confidence: number;
}

export interface SectionEvaluation {
  heading: string;
  generatedHeading?: string;
  alignmentConfidence: number;
  textSimilarity: number;
  numericFidelity: number;
  unitFidelity: number;
  completeness: number;
}

export interface DocumentEvaluationResult {
  runId: string;
  timestamp: string;
  reference: {
    path: string;
    fileName: string;
  };
  generated: {
    path: string;
    fileName: string;
  };
  overallScore: number;
  decision: EvaluationDecision;
  metrics: {
    characterLevenshtein: MetricResult;
    wordLevenshtein: MetricResult;
    rouge1: MetricResult;
    rouge2: MetricResult;
    rougeL: MetricResult;
    tfidfCosine: MetricResult;
    sectionCoverage: MetricResult;
    headingCoverage: MetricResult;
    sectionOrder: MetricResult;
    numericFidelity: MetricResult;
    unitFidelity: MetricResult;
    formulaFidelity: MetricResult;
    tableFidelity: MetricResult;
    completeness: MetricResult;
  };
  sectionResults: SectionEvaluation[];
  criticalIssues: CriticalIssue[];
  potentiallyMissingContent: string[];
  potentiallyExtraContent: string[];
}
