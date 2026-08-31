import type { NormalizedDocument } from "../contracts/normalized-document.js";
import type { Ruleset, SopRule } from "../contracts/rule.js";

export interface RuleValidationSummary {
  generated: number;
  valid: number;
  requiresReview: number;
  sensors: Array<{ sensor: string; status: "PASS" | "FAIL" | "WARN"; message?: string }>;
}

const severities = new Set(["critical", "major", "minor", "informational"]);
const statuses = new Set(["pending_approval", "approved", "rejected"]);

function sourceTextContained(rule: SopRule, sop: NormalizedDocument): boolean {
  const text = rule.source.sourceText.toLowerCase();
  return rule.source.sourceBlockIds.some((blockId) => {
    const block = sop.blocks.find((candidate) => candidate.blockId === blockId);
    return block ? block.text.toLowerCase().includes(text.slice(0, Math.min(text.length, 40)).toLowerCase()) || text.includes(block.text.toLowerCase()) : false;
  });
}

function modalityValid(rule: SopRule): boolean {
  const source = rule.source.sourceText.toLowerCase();
  const statement = rule.statement.toLowerCase();
  if (source.includes("should") && statement.includes("shall")) return false;
  if (source.includes("may") && (statement.includes("shall") || statement.includes("must"))) return false;
  return true;
}

export function validateRuleset(ruleset: Ruleset, sop: NormalizedDocument): RuleValidationSummary {
  const seenStatements = new Set<string>();
  const sensors: RuleValidationSummary["sensors"] = [];
  let valid = 0;
  let requiresReview = 0;

  for (const rule of ruleset.rules) {
    const messages: string[] = [];
    const schemaValid = Boolean(rule.ruleId && rule.rulesetId && rule.title && rule.statement && severities.has(rule.severity) && statuses.has(rule.status));
    const sourcesValid = rule.source.documentId === sop.documentId && rule.source.sourceBlockIds.every((blockId) => sop.blocks.some((block) => block.blockId === blockId));
    const sourceTextValid = sourceTextContained(rule, sop);
    const modal = modalityValid(rule);
    const key = rule.statement.toLowerCase().replace(/\s+/g, " ").trim();
    const duplicate = seenStatements.has(key);
    seenStatements.add(key);

    if (!schemaValid) messages.push("schema sensor failed");
    if (!sourcesValid) messages.push("source-reference sensor failed");
    if (!sourceTextValid) messages.push("source-text sensor warning");
    if (!modal) messages.push("modality sensor failed");
    if (duplicate) messages.push("duplicate-rule sensor warning");
    if (rule.status !== "pending_approval") messages.push("approval-state sensor expected pending_approval for generated rules");

    const grounding = rule.validation?.grounding;
    const needsReview = !grounding || !grounding.supported || grounding.score < 0.85 || !sourceTextValid || duplicate;
    rule.validation = {
      schemaValid,
      sourcesValid,
      sourceTextValid,
      modalityValid: modal,
      duplicate,
      grounding,
      requiresReview: needsReview,
      messages
    };

    if (schemaValid && sourcesValid && modal) valid += 1;
    if (needsReview) requiresReview += 1;
  }

  sensors.push({ sensor: "schema", status: ruleset.rules.every((rule) => rule.validation?.schemaValid) ? "PASS" : "FAIL" });
  sensors.push({ sensor: "source-reference", status: ruleset.rules.every((rule) => rule.validation?.sourcesValid) ? "PASS" : "FAIL" });
  sensors.push({ sensor: "source-text", status: ruleset.rules.every((rule) => rule.validation?.sourceTextValid) ? "PASS" : "WARN" });
  sensors.push({ sensor: "modality", status: ruleset.rules.every((rule) => rule.validation?.modalityValid) ? "PASS" : "FAIL" });
  sensors.push({ sensor: "duplicate-rule", status: ruleset.rules.some((rule) => rule.validation?.duplicate) ? "WARN" : "PASS" });
  sensors.push({ sensor: "approval-state", status: ruleset.rules.every((rule) => rule.status === "pending_approval") ? "PASS" : "FAIL" });

  return { generated: ruleset.rules.length, valid, requiresReview, sensors };
}

export function assertRuleUsableForQc(rule: SopRule): boolean {
  return rule.status === "approved";
}
