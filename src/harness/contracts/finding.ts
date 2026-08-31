import type { RuleSeverity } from "./rule.js";

export type FindingDecision = "ACCEPTED" | "HUMAN_REVIEW" | "REJECTED";

export interface QcFinding {
  findingId: string;
  runId: string;
  status: "open";
  decision: FindingDecision;
  severity: RuleSeverity;
  title: string;
  description: string;
  target: {
    documentId: string;
    blockIds: string[];
    section?: string;
    observedText: string;
  };
  rule: {
    ruleId: string;
    rulesetId: string;
    title: string;
  };
  sopSource: {
    documentId: string;
    documentName: string;
    section?: string;
    sourceBlockIds: string[];
    sourceText?: string;
  };
  explanation: {
    expected: string;
    observed: string;
    reason: string;
  };
  evaluation: {
    ruleExists: boolean;
    ruleApproved: boolean;
    ruleGrounded: boolean;
    findingGrounded: boolean;
    provenanceValid: boolean;
    score: number;
    reason?: string;
  };
}

export interface FindingGroundingEvaluation {
  supported: boolean;
  ruleAppliedCorrectly: boolean;
  targetEvidenceSupportsFinding: boolean;
  contradictions: string[];
  score: number;
  reason: string;
}
