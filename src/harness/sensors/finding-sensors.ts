import type { NormalizedDocument } from "../contracts/normalized-document.js";
import type { QcFinding } from "../contracts/finding.js";
import type { SopRule } from "../contracts/rule.js";

export interface FindingValidationResult {
  finding: QcFinding;
  sensors: Array<{ sensor: string; status: "PASS" | "FAIL"; message?: string }>;
}

export function validateFindings(findings: QcFinding[], approvedRules: SopRule[], target: NormalizedDocument): FindingValidationResult[] {
  const seen = new Set<string>();
  return findings.map((finding) => {
    const rule = approvedRules.find((candidate) => candidate.ruleId === finding.rule.ruleId);
    const ruleExists = Boolean(rule);
    const ruleApproved = rule?.status === "approved";
    const targetReference = finding.target.blockIds.every((blockId) => target.blocks.some((block) => block.blockId === blockId));
    const sopLineage = Boolean(rule && rule.rulesetId === finding.rule.rulesetId && rule.source.documentId === finding.sopSource.documentId);
    const sourceBlocksValid = Boolean(rule && finding.sopSource.sourceBlockIds.every((blockId) => rule.source.sourceBlockIds.includes(blockId)));
    const duplicateKey = `${finding.rule.ruleId}:${finding.target.blockIds.join(",")}:${finding.title.toLowerCase()}`;
    const duplicate = seen.has(duplicateKey);
    seen.add(duplicateKey);
    const provenanceValid = ruleExists && ruleApproved && targetReference && sopLineage && sourceBlocksValid;

    finding.evaluation.ruleExists = ruleExists;
    finding.evaluation.ruleApproved = ruleApproved;
    finding.evaluation.ruleGrounded = Boolean(rule?.validation?.grounding?.supported ?? true);
    finding.evaluation.provenanceValid = provenanceValid;
    finding.evaluation.score = [
      ruleExists,
      ruleApproved,
      targetReference,
      sopLineage,
      sourceBlocksValid,
      !duplicate,
      finding.evaluation.findingGrounded
    ].filter(Boolean).length / 7;

    if (!ruleExists || !ruleApproved || !targetReference || !sopLineage || !sourceBlocksValid || duplicate) {
      finding.decision = "REJECTED";
    } else if (!finding.evaluation.findingGrounded || finding.evaluation.score < 0.85) {
      finding.decision = "HUMAN_REVIEW";
    } else {
      finding.decision = "ACCEPTED";
    }

    return {
      finding,
      sensors: [
        { sensor: "finding-schema-check", status: finding.findingId && finding.title ? "PASS" : "FAIL" },
        { sensor: "rule-exists-check", status: ruleExists ? "PASS" : "FAIL" },
        { sensor: "approved-rule-check", status: ruleApproved ? "PASS" : "FAIL" },
        { sensor: "target-reference-check", status: targetReference ? "PASS" : "FAIL" },
        { sensor: "sop-lineage-check", status: sopLineage ? "PASS" : "FAIL" },
        { sensor: "duplicate-finding-check", status: duplicate ? "FAIL" : "PASS" },
        { sensor: "provenance-integrity-check", status: provenanceValid ? "PASS" : "FAIL" }
      ]
    };
  });
}
