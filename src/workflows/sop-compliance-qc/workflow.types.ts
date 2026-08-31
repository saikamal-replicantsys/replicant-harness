import type { QcFinding } from "../../harness/contracts/finding.js";
import type { Ruleset, SopRule } from "../../harness/contracts/rule.js";

export interface RuleCandidateResponse {
  rules: SopRule[];
}

export interface FindingCandidateResponse {
  findings: QcFinding[];
}

export interface RuleGenerationResult {
  ruleset: Ruleset;
  generatedPath: string;
  tracePath: string;
}

export interface QcRunResult {
  runId: string;
  findings: QcFinding[];
  accepted: QcFinding[];
  humanReview: QcFinding[];
  rejected: QcFinding[];
  reportPath: string;
  findingsPath: string;
  oldQcPath: string;
  tracePath: string;
}
