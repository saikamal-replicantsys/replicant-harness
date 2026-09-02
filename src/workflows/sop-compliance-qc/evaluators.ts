import type { AIProvider } from "../../providers/provider.js";
import type { NormalizedBlock } from "../../harness/contracts/normalized-document.js";
import type { FindingGroundingEvaluation, QcFinding } from "../../harness/contracts/finding.js";
import type { GroundingEvaluation, SopRule } from "../../harness/contracts/rule.js";
import { findingGroundingSchema, groundingSchema } from "../../providers/structured-schemas.js";

export async function evaluateRuleGrounding(provider: AIProvider, rule: SopRule, evidence: NormalizedBlock[]): Promise<GroundingEvaluation> {
  const result = await provider.generateStructured<GroundingEvaluation>({
    runId: `rule-grounding-${rule.ruleId}`,
    guideId: "sop-rule-grounding",
    guideVersion: "1.0.0",
    schemaName: "rule-grounding",
    schema: groundingSchema,
    system: "Evaluate whether supplied SOP evidence supports the candidate rule. Return concise structured JSON only.",
    prompt: JSON.stringify({ evidence, rule })
  });
  return result.parsed;
}

export async function evaluateFindingGrounding(provider: AIProvider, finding: QcFinding, rule: SopRule, sopEvidence: NormalizedBlock[], targetEvidence: NormalizedBlock[], sourceEvidence: NormalizedBlock[] = []): Promise<FindingGroundingEvaluation> {
  const result = await provider.generateStructured<FindingGroundingEvaluation>({
    runId: `finding-grounding-${finding.findingId}`,
    guideId: "sop-finding-grounding",
    guideVersion: "1.0.0",
    schemaName: "finding-grounding",
    schema: findingGroundingSchema,
    system: "Evaluate whether the approved rule, target evidence, and any cited supporting source evidence support the candidate finding. Return concise structured JSON only.",
    prompt: JSON.stringify({ rule, sopEvidence, targetEvidence, sourceEvidence, finding })
  });
  return result.parsed;
}
