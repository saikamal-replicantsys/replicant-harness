import type { AIProvider, StructuredGenerationRequest, StructuredGenerationResult } from "./provider.js";
import type { QcFinding } from "../harness/contracts/finding.js";
import type { GroundingEvaluation, SopRule } from "../harness/contracts/rule.js";

export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly model = "mock-deterministic-fixture";

  async generateStructured<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>> {
    const started = Date.now();
    const parsed = this.fixtureFor(request) as T;
    return {
      provider: this.name,
      model: this.model,
      rawText: JSON.stringify(parsed),
      parsed,
      latencyMs: Date.now() - started,
      tokenUsage: { input: 0, output: 0 }
    };
  }

  private fixtureFor(request: StructuredGenerationRequest): unknown {
    if (request.schemaName === "sop-rule-candidates") return { rules: mockRules() };
    if (request.schemaName === "rule-grounding") {
      return { supported: true, modalityPreserved: true, scopePreserved: true, unsupportedAdditions: [], score: 0.96, reason: "The rule is directly supported by supplied SOP evidence." } satisfies GroundingEvaluation;
    }
    if (request.schemaName === "qc-finding-candidates") return { findings: mockFindings() };
    if (request.schemaName === "finding-grounding") {
      return { supported: true, ruleAppliedCorrectly: true, targetEvidenceSupportsFinding: true, contradictions: [], score: 0.94, reason: "The target block omits the required effective date while the approved rule requires it." };
    }
    return {};
  }
}

function mockRules(): SopRule[] {
  const generatedAt = new Date("2026-08-31T00:00:00.000Z").toISOString();
  const base = {
    rulesetId: "RULESET-SOP-DEMO-001",
    applicability: { documentTypes: ["controlled_document", "batch_record"], conditions: [] },
    status: "pending_approval" as const,
    generation: { provider: "mock", model: "mock-deterministic-fixture", generatedAt, confidence: 0.94 }
  };
  return [
    {
      ...base,
      ruleId: "SOP-DEMO-001-R001",
      title: "Document number is required",
      statement: "Controlled documents shall contain a document number.",
      description: "Controlled documents require a document number for identification.",
      ruleType: "required_content",
      severity: "major",
      requirement: { type: "required_field", field: "document_number" },
      source: { documentId: "SOP-DEMO-001", sourceBlockIds: ["SOP-DEMO-001-B004"], section: "5.1 Document Identification", sourceText: "document number" }
    },
    {
      ...base,
      ruleId: "SOP-DEMO-001-R002",
      title: "Title is required",
      statement: "Controlled documents shall contain a title.",
      description: "Controlled documents require a title.",
      ruleType: "required_content",
      severity: "major",
      requirement: { type: "required_field", field: "title" },
      source: { documentId: "SOP-DEMO-001", sourceBlockIds: ["SOP-DEMO-001-B005"], section: "5.1 Document Identification", sourceText: "title" }
    },
    {
      ...base,
      ruleId: "SOP-DEMO-001-R003",
      title: "Version number is required",
      statement: "Controlled documents shall contain a version number.",
      description: "Controlled documents require version identification.",
      ruleType: "required_content",
      severity: "major",
      requirement: { type: "required_field", field: "version_number" },
      source: { documentId: "SOP-DEMO-001", sourceBlockIds: ["SOP-DEMO-001-B006"], section: "5.1 Document Identification", sourceText: "version number" }
    },
    {
      ...base,
      ruleId: "SOP-DEMO-001-R004",
      title: "Effective date is required",
      statement: "Controlled documents shall display an effective date before release.",
      description: "Released controlled documents require an effective date.",
      ruleType: "required_content",
      severity: "major",
      requirement: { type: "required_field", field: "effective_date" },
      source: { documentId: "SOP-DEMO-001", sourceBlockIds: ["SOP-DEMO-001-B008"], section: "5.2 Effective Date", sourceText: "Controlled documents shall display an effective date before release." }
    },
    {
      ...base,
      ruleId: "SOP-DEMO-001-R005",
      title: "Designated approver evidence is required",
      statement: "Controlled documents shall contain evidence of approval by the designated approver.",
      description: "Approval evidence must be present before the document is treated as controlled.",
      ruleType: "required_content",
      severity: "major",
      requirement: { type: "required_field", field: "approval_evidence" },
      source: { documentId: "SOP-DEMO-001", sourceBlockIds: ["SOP-DEMO-001-B010"], section: "5.3 Approval", sourceText: "Controlled documents shall contain evidence of approval by the designated approver." }
    },
    {
      ...base,
      ruleId: "SOP-DEMO-001-R006",
      title: "Periodic review should be scheduled",
      statement: "Documents should be reviewed periodically according to the applicable review schedule.",
      description: "The SOP recommends periodic review; modality remains should.",
      ruleType: "review",
      severity: "minor",
      requirement: { type: "recommended_review", field: "review_schedule" },
      source: { documentId: "SOP-DEMO-001", sourceBlockIds: ["SOP-DEMO-001-B012"], section: "5.4 Review", sourceText: "Documents should be reviewed periodically according to the applicable review schedule." }
    }
  ];
}

function mockFindings(): QcFinding[] {
  return [
    {
      findingId: "QC-F-001",
      runId: "QC-RUN-DEMO-001",
      status: "open",
      decision: "ACCEPTED",
      severity: "major",
      title: "Effective date is missing",
      description: "The document does not contain the effective date required by the approved SOP rule.",
      target: { documentId: "TARGET-DEMO-001", blockIds: ["TARGET-DEMO-001-B002", "TARGET-DEMO-001-B003", "TARGET-DEMO-001-B004", "TARGET-DEMO-001-B005"], section: "Document Header", observedText: "Document Number: BMR-2026-014\nTitle: Batch Manufacturing Record\nVersion: 03\nApproved By: Quality Assurance" },
      rule: { ruleId: "SOP-DEMO-001-R004", rulesetId: "RULESET-SOP-DEMO-001", title: "Effective date is required" },
      sopSource: { documentId: "SOP-DEMO-001", documentName: "document-control-sop.md", section: "5.2 Effective Date", sourceBlockIds: ["SOP-DEMO-001-B008"], sourceText: "Controlled documents shall display an effective date before release." },
      explanation: { expected: "An effective date must be present before release.", observed: "No effective date was identified in the document header.", reason: "The approved SOP rule requires an effective date, and the reviewed target content omits it." },
      evaluation: { ruleExists: false, ruleApproved: false, ruleGrounded: false, findingGrounded: false, provenanceValid: false, score: 0 }
    }
  ];
}
