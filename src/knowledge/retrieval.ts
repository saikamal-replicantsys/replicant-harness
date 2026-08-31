import type { NormalizedDocument } from "../harness/contracts/normalized-document.js";
import type { SopRule } from "../harness/contracts/rule.js";

export interface RetrievedRule {
  rule: SopRule;
  score: number;
  reason: string;
}

export interface RuleRetriever {
  retrieve(document: NormalizedDocument, rules: SopRule[]): Promise<RetrievedRule[]>;
}

export class SimpleRuleRetriever implements RuleRetriever {
  async retrieve(document: NormalizedDocument, rules: SopRule[]): Promise<RetrievedRule[]> {
    const text = document.fullText.toLowerCase();
    return rules
      .filter((rule) => rule.status === "approved")
      .map((rule) => {
        const words = rule.statement.toLowerCase().split(/[^a-z0-9_]+/).filter((word) => word.length > 3);
        const hits = words.filter((word) => text.includes(word)).length;
        return {
          rule,
          score: words.length === 0 ? 0 : hits / words.length,
          reason: hits > 0 ? "keyword overlap with target document" : "approved rule included for small-rule-volume V1"
        };
      });
  }
}
