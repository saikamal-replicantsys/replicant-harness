import type { QcFinding } from "../../harness/contracts/finding.js";
import type { SopRule } from "../../harness/contracts/rule.js";

export function buildClientReport(params: {
  targetTitle: string;
  evidenceTitles?: string[];
  rulesetsLoaded: number;
  rulesEvaluated: number;
  finalDecision: "ACCEPT" | "HUMAN_REVIEW" | "REJECT";
  accepted: QcFinding[];
  humanReview: QcFinding[];
  rejected: QcFinding[];
  approvedRules: SopRule[];
}): string {
  const evidenceBlock = (finding: QcFinding): string => {
    if (!finding.evidenceSources?.length) return "None.";
    return finding.evidenceSources.map((source) => [
      `- Source: ${source.fileName ?? source.documentId}`,
      source.sourceFile ? `  File: ${source.sourceFile}` : undefined,
      source.section ? `  Section/Sheet: ${source.section}` : undefined,
      `  Blocks: ${source.blockIds.join(", ")}`,
      `  Evidence: "${source.observedText}"`
    ].filter(Boolean).join("\n")).join("\n");
  };

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

Supporting Source Evidence:
${evidenceBlock(finding)}

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

Supporting Source Documents:
${params.evidenceTitles?.length ? params.evidenceTitles.map((title) => `- ${title}`).join("\n") : "None."}

Approved Rulesets:
${params.rulesetsLoaded}

Rules Evaluated:
${params.rulesEvaluated}

Accepted Findings:
${params.accepted.length}

Human Review:
${params.humanReview.length}

Rejected Findings:
${params.rejected.length}

Final Decision:
${params.finalDecision}

## Findings

${params.accepted.length ? params.accepted.map(findingBlock).join("\n") : "No accepted findings."}

## Human Review Findings

${params.humanReview.length ? params.humanReview.map(findingBlock).join("\n") : "None."}

## Rejected Candidate Findings

${params.rejected.length ? params.rejected.map(findingBlock).join("\n") : "None."}
`;
}
