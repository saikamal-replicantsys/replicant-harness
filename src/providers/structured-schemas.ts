export const ruleCandidatesSchema = {
  type: "object",
  properties: {
    rules: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ruleId: { type: "string" },
          rulesetId: { type: "string" },
          title: { type: "string" },
          statement: { type: "string" },
          description: { type: "string" },
          ruleType: { type: "string" },
          severity: { type: "string" },
          applicability: {
            type: "object",
            properties: {
              documentTypes: { type: "array", items: { type: "string" } },
              conditions: { type: "array", items: { type: "string" } }
            },
            required: ["documentTypes", "conditions"]
          },
          requirement: { type: "object" },
          source: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              sourceBlockIds: { type: "array", items: { type: "string" } },
              section: { type: "string" },
              sourceText: { type: "string" }
            },
            required: ["documentId", "sourceBlockIds", "sourceText"]
          },
          status: { type: "string" },
          generation: { type: "object" }
        },
        required: ["ruleId", "rulesetId", "title", "statement", "description", "ruleType", "severity", "applicability", "requirement", "source", "status", "generation"]
      }
    }
  },
  required: ["rules"]
} as const;

export const groundingSchema = {
  type: "object",
  properties: {
    supported: { type: "boolean" },
    modalityPreserved: { type: "boolean" },
    scopePreserved: { type: "boolean" },
    unsupportedAdditions: { type: "array", items: { type: "string" } },
    score: { type: "number" },
    reason: { type: "string" }
  },
  required: ["supported", "modalityPreserved", "scopePreserved", "unsupportedAdditions", "score", "reason"]
} as const;

export const findingsSchema = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          findingId: { type: "string" },
          runId: { type: "string" },
          status: { type: "string" },
          decision: { type: "string" },
          severity: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          target: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              blockIds: { type: "array", items: { type: "string" } },
              section: { type: "string" },
              observedText: { type: "string" }
            },
            required: ["documentId", "blockIds", "observedText"]
          },
          evidenceSources: {
            type: "array",
            items: {
              type: "object",
              properties: {
                documentId: { type: "string" },
                fileName: { type: "string" },
                sourceFile: { type: "string" },
                blockIds: { type: "array", items: { type: "string" } },
                section: { type: "string" },
                observedText: { type: "string" }
              },
              required: ["documentId", "blockIds", "observedText"]
            }
          },
          rule: {
            type: "object",
            properties: {
              ruleId: { type: "string" },
              rulesetId: { type: "string" },
              title: { type: "string" }
            },
            required: ["ruleId", "rulesetId", "title"]
          },
          sopSource: {
            type: "object",
            properties: {
              documentId: { type: "string" },
              documentName: { type: "string" },
              section: { type: "string" },
              sourceBlockIds: { type: "array", items: { type: "string" } },
              sourceText: { type: "string" }
            },
            required: ["documentId", "documentName", "sourceBlockIds"]
          },
          explanation: {
            type: "object",
            properties: {
              expected: { type: "string" },
              observed: { type: "string" },
              reason: { type: "string" }
            },
            required: ["expected", "observed", "reason"]
          },
          evaluation: {
            type: "object",
            properties: {
              ruleExists: { type: "boolean" },
              ruleApproved: { type: "boolean" },
              ruleGrounded: { type: "boolean" },
              findingGrounded: { type: "boolean" },
              provenanceValid: { type: "boolean" },
              score: { type: "number" },
              reason: { type: "string" }
            },
            required: ["ruleExists", "ruleApproved", "ruleGrounded", "findingGrounded", "provenanceValid", "score"]
          }
        },
        required: ["findingId", "runId", "status", "decision", "severity", "title", "description", "target", "rule", "sopSource", "explanation", "evaluation"]
      }
    }
  },
  required: ["findings"]
} as const;

export const findingGroundingSchema = {
  type: "object",
  properties: {
    supported: { type: "boolean" },
    ruleAppliedCorrectly: { type: "boolean" },
    targetEvidenceSupportsFinding: { type: "boolean" },
    contradictions: { type: "array", items: { type: "string" } },
    score: { type: "number" },
    reason: { type: "string" }
  },
  required: ["supported", "ruleAppliedCorrectly", "targetEvidenceSupportsFinding", "contradictions", "score", "reason"]
} as const;
