export type RuleStatus = "pending_approval" | "approved" | "rejected";
export type RuleSeverity = "critical" | "major" | "minor" | "informational";
export type RuleType = "required_content" | "prohibited_content" | "format" | "conditional" | "review";

export interface SopRule {
  ruleId: string;
  rulesetId: string;
  title: string;
  statement: string;
  description: string;
  ruleType: RuleType;
  severity: RuleSeverity;
  applicability: {
    documentTypes: string[];
    conditions: string[];
  };
  requirement: {
    type: string;
    field?: string;
    value?: string;
  };
  source: {
    documentId: string;
    sourceBlockIds: string[];
    section?: string;
    sourceText: string;
  };
  status: RuleStatus;
  validation?: {
    schemaValid: boolean;
    sourcesValid: boolean;
    sourceTextValid: boolean;
    modalityValid: boolean;
    duplicate: boolean;
    grounding?: GroundingEvaluation;
    requiresReview?: boolean;
    messages: string[];
  };
  generation: {
    provider: string;
    model: string;
    generatedAt: string;
    confidence: number;
  };
}

export interface Ruleset {
  rulesetId: string;
  sopDocumentId: string;
  sopFileName: string;
  title: string;
  status: "generated" | "partially_approved" | "approved";
  generatedAt: string;
  rules: SopRule[];
}

export interface GroundingEvaluation {
  supported: boolean;
  modalityPreserved: boolean;
  scopePreserved: boolean;
  unsupportedAdditions: string[];
  score: number;
  reason: string;
}
