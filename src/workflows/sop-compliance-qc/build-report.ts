import type { QcFinding } from "../../harness/contracts/finding.js";
import type { SopRule } from "../../harness/contracts/rule.js";

export function buildClientReport(params: {
  targetTitle: string;
  rulesetsLoaded: number;
  rulesEvaluated: number;
  accepted: QcFinding[];
  humanReview: QcFinding[];
  approvedRules: SopRule[];
}): string {
  const findingBlock = (finding: QcFinding) => `### ${finding.findingId} - ${finding.title}

Severity: ${finding.severity}

Description:
${finding.description}

Expected:
${finding.explanation.expected}

Observed:
${finding.explanation.observed}

Rule:
${finding.rule.ruleId} - ${finding.rule.title}

Ruleset:
${finding.rule.rulesetId}

SOP:
${finding.sopSource.documentName}

SOP Section:
${finding.sopSource.section ?? "Unknown"}

SOP Evidence:
"${finding.sopSource.sourceText ?? finding.explanation.expected}"

Target Evidence:
"${finding.target.observedText}"

Harness Validation:
- Rule exists: ${finding.evaluation.ruleExists ? "PASS" : "FAIL"}
- Rule approved: ${finding.evaluation.ruleApproved ? "PASS" : "FAIL"}
- Rule grounding: ${finding.evaluation.ruleGrounded ? "PASS" : "FAIL"}
- Target grounding: ${finding.evaluation.findingGrounded ? "PASS" : "FAIL"}
- Provenance integrity: ${finding.evaluation.provenanceValid ? "PASS" : "FAIL"}

Evaluator reason:
${finding.evaluation.reason ?? "No evaluator reason supplied."}
`;

  return `# SOP Compliance QC Report

## Summary

Document:
${params.targetTitle}

Approved Rulesets:
${params.rulesetsLoaded}

Rules Evaluated:
${params.rulesEvaluated}

Accepted Findings:
${params.accepted.length}

Human Review:
${params.humanReview.length}

## Findings

${params.accepted.length ? params.accepted.map(findingBlock).join("\n") : "No accepted findings."}

## Human Review Findings

${params.humanReview.length ? params.humanReview.map(findingBlock).join("\n") : "None."}
`;
}
