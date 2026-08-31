import type { QcFinding } from "../harness/contracts/finding.js";

export function toConceptualOldQc(findings: QcFinding[]) {
  return findings.filter((finding) => finding.decision === "ACCEPTED").map((finding) => ({
    id: finding.findingId,
    type: "sop_compliance",
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    adapterLabel: "conceptual old-QC adapter",
    ruleMetadata: {
      ruleId: finding.rule.ruleId,
      rulesetId: finding.rule.rulesetId,
      sopDocument: finding.sopSource.documentName,
      sopSection: finding.sopSource.section,
      sopSourceText: finding.sopSource.sourceText ?? finding.explanation.expected
    },
    target: {
      blockId: finding.target.blockIds[0],
      text: finding.target.observedText
    }
  }));
}
