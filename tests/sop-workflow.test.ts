import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveClientScope } from "../src/client/client-scope.js";
import { MarkdownDocumentAdapter } from "../src/documents/markdown.adapter.js";
import { validateRuleset, assertRuleUsableForQc } from "../src/harness/sensors/rule-sensors.js";
import { validateFindings } from "../src/harness/sensors/finding-sensors.js";
import type { QcFinding } from "../src/harness/contracts/finding.js";
import type { Ruleset, SopRule } from "../src/harness/contracts/rule.js";
import { SimpleRuleRetriever } from "../src/knowledge/retrieval.js";
import { GraphStore } from "../src/knowledge/graph.store.js";
import { MockAIProvider } from "../src/providers/mock.provider.js";
import type { AIProvider, StructuredGenerationRequest, StructuredGenerationResult } from "../src/providers/provider.js";
import { runQc } from "../src/workflows/sop-compliance-qc/run-qc.js";
import { runQcCase } from "../src/workflows/sop-compliance-qc/run-qc-case.js";
import { writeJson } from "../src/workflows/sop-compliance-qc/store.js";

const adapter = new MarkdownDocumentAdapter();

class MalformedFindingProvider implements AIProvider {
  readonly name = "malformed";
  readonly model = "malformed-test";

  async generateStructured<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>> {
    const parsed = request.schemaName === "qc-finding-candidates"
      ? { findings: [{ findingId: "BAD-001", title: "Incomplete provider finding", severity: "major", target: {}, rule: {}, sopSource: {}, explanation: {}, evaluation: {} }] }
      : { supported: true, ruleAppliedCorrectly: true, targetEvidenceSupportsFinding: true, contradictions: [], score: 0.95, reason: "supported" };
    return { provider: this.name, model: this.model, rawText: JSON.stringify(parsed), parsed: parsed as T, latencyMs: 0 };
  }
}

class AcceptedFindingProvider implements AIProvider {
  readonly name = "accepted-finding";
  readonly model = "accepted-finding-test";

  async generateStructured<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>> {
    if (request.schemaName === "finding-grounding") {
      const parsed = { supported: true, ruleAppliedCorrectly: true, targetEvidenceSupportsFinding: true, contradictions: [], score: 0.95, reason: "supported" };
      return { provider: this.name, model: this.model, rawText: JSON.stringify(parsed), parsed: parsed as T, latencyMs: 0 };
    }
    const prompt = JSON.parse(request.prompt);
    const target = prompt.targetDocument;
    const rule = prompt.approvedRules[0];
    const parsed = {
      findings: [{
        findingId: "QC-F-ACCEPTED-001",
        decision: "ACCEPTED",
        severity: "major",
        title: "Effective date is missing",
        description: "The document does not contain an effective date.",
        target: {
          documentId: target.documentId,
          blockIds: target.blocks.slice(1, 3).map((block: { blockId: string }) => block.blockId),
          section: "Document Header",
          observedText: "No effective date was identified."
        },
        rule: { ruleId: rule.ruleId, rulesetId: rule.rulesetId, title: rule.title },
        sopSource: {
          documentId: rule.source.documentId,
          documentName: "document-control-sop.md",
          section: rule.source.section,
          sourceBlockIds: rule.source.sourceBlockIds,
          sourceText: rule.source.sourceText
        },
        explanation: { expected: "An effective date must be present.", observed: "No effective date was identified.", reason: "Required metadata is absent." },
        evaluation: { ruleExists: false, ruleApproved: false, ruleGrounded: false, findingGrounded: false, provenanceValid: false, score: 0 }
      }]
    };
    return { provider: this.name, model: this.model, rawText: JSON.stringify(parsed), parsed: parsed as T, latencyMs: 0 };
  }
}

class CaseFindingProvider implements AIProvider {
  readonly name = "case-finding";
  readonly model = "case-finding-test";

  async generateStructured<T>(request: StructuredGenerationRequest): Promise<StructuredGenerationResult<T>> {
    if (request.schemaName === "finding-grounding") {
      const parsed = { supported: true, ruleAppliedCorrectly: true, targetEvidenceSupportsFinding: true, contradictions: [], score: 0.95, reason: "supported by target and source evidence" };
      return { provider: this.name, model: this.model, rawText: JSON.stringify(parsed), parsed: parsed as T, latencyMs: 0 };
    }
    const prompt = JSON.parse(request.prompt);
    const target = prompt.targetDocument;
    const source = prompt.supportingSourceDocuments[0];
    const rule = prompt.approvedRules[0];
    const parsed = {
      findings: [{
        findingId: "QC-CASE-F-001",
        decision: "ACCEPTED",
        severity: "major",
        title: "Effective date is missing from case target",
        description: "The target omits the required effective date and the source workbook confirms release metadata was reviewed.",
        target: {
          documentId: target.documentId,
          blockIds: target.blocks.slice(1, 2).map((block: { blockId: string }) => block.blockId),
          section: "Document Header",
          observedText: "No effective date appears in the target header."
        },
        evidenceSources: [{
          documentId: source.documentId,
          fileName: source.fileName,
          sourceFile: source.sourceFile,
          blockIds: source.blocks.slice(1, 2).map((block: { blockId: string }) => block.blockId),
          section: "Sheet: Results",
          observedText: "A1: Release metadata reviewed"
        }],
        rule: { ruleId: rule.ruleId, rulesetId: rule.rulesetId, title: rule.title },
        sopSource: {
          documentId: rule.source.documentId,
          documentName: "document-control-sop.md",
          section: rule.source.section,
          sourceBlockIds: rule.source.sourceBlockIds,
          sourceText: rule.source.sourceText
        },
        explanation: { expected: "An effective date must be present.", observed: "No effective date was identified.", reason: "Required metadata is absent." },
        evaluation: { ruleExists: false, ruleApproved: false, ruleGrounded: false, findingGrounded: false, provenanceValid: false, score: 0 }
      }]
    };
    return { provider: this.name, model: this.model, rawText: JSON.stringify(parsed), parsed: parsed as T, latencyMs: 0 };
  }
}

function sampleRule(status: SopRule["status"] = "pending_approval"): SopRule {
  return {
    ruleId: "SOP-DEMO-001-R004",
    rulesetId: "RULESET-SOP-DEMO-001",
    title: "Effective date is required",
    statement: "Controlled documents shall display an effective date before release.",
    description: "Released controlled documents require an effective date.",
    ruleType: "required_content",
    severity: "major",
    applicability: { documentTypes: ["batch_record"], conditions: [] },
    requirement: { type: "required_field", field: "effective_date" },
    source: {
      documentId: "SOP-DEMO-001",
      sourceBlockIds: ["SOP-DEMO-001-B008"],
      section: "5.2 Effective Date",
      sourceText: "Controlled documents shall display an effective date before release."
    },
    status,
    generation: { provider: "mock", model: "mock", generatedAt: "2026-08-31T00:00:00.000Z", confidence: 0.94 },
    validation: {
      schemaValid: true,
      sourcesValid: true,
      sourceTextValid: true,
      modalityValid: true,
      duplicate: false,
      grounding: { supported: true, modalityPreserved: true, scopePreserved: true, unsupportedAdditions: [], score: 0.95, reason: "supported" },
      messages: []
    }
  };
}

function sampleFinding(ruleId = "SOP-DEMO-001-R004"): QcFinding {
  return {
    findingId: "QC-F-001",
    runId: "QC-RUN-TEST",
    status: "open",
    decision: "HUMAN_REVIEW",
    severity: "major",
    title: "Effective date is missing",
    description: "The document does not contain an effective date.",
    target: { documentId: "TARGET-DEMO-001", blockIds: ["TARGET-DEMO-001-B002"], section: "Document Header", observedText: "Document Number: BMR-2026-014" },
    rule: { ruleId, rulesetId: "RULESET-SOP-DEMO-001", title: "Effective date is required" },
    sopSource: { documentId: "SOP-DEMO-001", documentName: "document-control-sop.md", section: "5.2 Effective Date", sourceBlockIds: ["SOP-DEMO-001-B008"], sourceText: "Controlled documents shall display an effective date before release." },
    explanation: { expected: "An effective date must be present.", observed: "No effective date was identified.", reason: "Required metadata is absent." },
    evaluation: { ruleExists: false, ruleApproved: false, ruleGrounded: false, findingGrounded: true, provenanceValid: false, score: 0 }
  };
}

test("Markdown normalization preserves headings and blocks", async () => {
  const doc = await adapter.parse("data/demo/sop/document-control-sop.md", "sop");
  assert.equal(doc.documentId, "SOP-DEMO-001");
  assert.ok(doc.blocks.some((block) => block.type === "heading" && block.text === "5.2 Effective Date"));
});

test("Markdown adapter assigns deterministic block IDs", async () => {
  const first = await adapter.parse("data/demo/sop/document-control-sop.md", "sop");
  const second = await adapter.parse("data/demo/sop/document-control-sop.md", "sop");
  assert.deepEqual(first.blocks.map((block) => block.blockId), second.blocks.map((block) => block.blockId));
});

test("rule source IDs must exist", async () => {
  const sop = await adapter.parse("data/demo/sop/document-control-sop.md", "sop");
  const ruleset: Ruleset = { rulesetId: "RULESET-SOP-DEMO-001", sopDocumentId: sop.documentId, sopFileName: sop.fileName, title: "Rules", status: "generated", generatedAt: "now", rules: [sampleRule()] };
  assert.equal(validateRuleset(ruleset, sop).sensors.find((sensor) => sensor.sensor === "source-reference")?.status, "PASS");
});

test("rule missing source block ids is rejected without crashing", async () => {
  const sop = await adapter.parse("data/demo/sop/document-control-sop.md", "sop");
  const rule = sampleRule() as unknown as SopRule;
  delete (rule.source as Partial<SopRule["source"]>).sourceBlockIds;
  const ruleset: Ruleset = { rulesetId: "RULESET-SOP-DEMO-001", sopDocumentId: sop.documentId, sopFileName: sop.fileName, title: "Rules", status: "generated", generatedAt: "now", rules: [rule] };
  const validation = validateRuleset(ruleset, sop);
  assert.equal(validation.sensors.find((sensor) => sensor.sensor === "source-reference")?.status, "FAIL");
  assert.equal(validation.valid, 0);
});

test("pending rule cannot be used for QC", () => {
  assert.equal(assertRuleUsableForQc(sampleRule("pending_approval")), false);
});

test("rejected rule cannot be used for QC", () => {
  assert.equal(assertRuleUsableForQc(sampleRule("rejected")), false);
});

test("approved rule can be retrieved", async () => {
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const retrieved = await new SimpleRuleRetriever().retrieve(target, [sampleRule("approved")]);
  assert.equal(retrieved.length, 1);
});

test("finding with unknown rule is rejected", async () => {
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const [result] = validateFindings([sampleFinding("UNKNOWN-RULE")], [sampleRule("approved")], target);
  assert.equal(result?.finding.decision, "REJECTED");
});

test("finding referencing pending rule is rejected", async () => {
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const [result] = validateFindings([sampleFinding()], [sampleRule("pending_approval")], target);
  assert.equal(result?.finding.decision, "REJECTED");
});

test("finding with invalid target block is rejected", async () => {
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const finding = sampleFinding();
  finding.target.blockIds = ["TARGET-DEMO-001-B999"];
  const [result] = validateFindings([finding], [sampleRule("approved")], target);
  assert.equal(result?.finding.decision, "REJECTED");
});

test("finding missing target block ids is rejected without crashing", async () => {
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const finding = sampleFinding() as unknown as QcFinding;
  delete (finding.target as Partial<QcFinding["target"]>).blockIds;
  const [result] = validateFindings([finding], [sampleRule("approved")], target);
  assert.equal(result?.finding.decision, "REJECTED");
  assert.deepEqual(result?.finding.target.blockIds, []);
});

test("finding with invalid source evidence block is rejected", async () => {
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const evidence = await adapter.parse("data/demo/target/batch-record.md", "evidence");
  const finding = sampleFinding();
  finding.evidenceSources = [{
    documentId: evidence.documentId,
    fileName: evidence.fileName,
    blockIds: ["UNKNOWN-BLOCK"],
    section: "Sheet: Results",
    observedText: "Unsupported source citation"
  }];
  const [result] = validateFindings([finding], [sampleRule("approved")], target, [evidence]);
  assert.equal(result?.finding.decision, "REJECTED");
  assert.equal(result?.sensors.find((sensor) => sensor.sensor === "evidence-reference-check")?.status, "FAIL");
});

test("duplicate findings can be detected", async () => {
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const results = validateFindings([sampleFinding(), sampleFinding()], [sampleRule("approved")], target);
  assert.equal(results[1]?.finding.decision, "REJECTED");
});

test("QC run reports rejected malformed provider findings", async () => {
  const root = ".tmp/qc-malformed-provider/data/clients";
  await fs.rm(".tmp/qc-malformed-provider", { recursive: true, force: true });
  const scope = resolveClientScope("alpha", root);
  await fs.mkdir(scope.normalizedDir, { recursive: true });
  const targetPath = path.join(scope.normalizedDir, "target.md");
  await fs.writeFile(targetPath, "# Target\n\nDocument Number: BMR-001\n", "utf8");
  const ruleset: Ruleset = {
    rulesetId: "RULESET-SOP-DEMO-001",
    sopDocumentId: "SOP-DEMO-001",
    sopFileName: "document-control-sop.md",
    title: "Rules",
    status: "approved",
    generatedAt: "now",
    rules: [sampleRule("approved")]
  };
  await writeJson(path.join(scope.rulesetsApprovedDir, `${ruleset.rulesetId}.json`), ruleset);

  const result = await runQc(targetPath, new MalformedFindingProvider(), scope);
  const report = await fs.readFile(result.reportPath, "utf8");
  assert.equal(result.finalDecision, "REJECT");
  assert.equal(result.rejected.length, 1);
  assert.match(report, /Rejected Findings:\n1/);
  assert.match(report, /## Rejected Candidate Findings/);
});

test("QC run rejects documents with accepted major findings", async () => {
  const root = ".tmp/qc-accepted-finding/data/clients";
  await fs.rm(".tmp/qc-accepted-finding", { recursive: true, force: true });
  const scope = resolveClientScope("alpha", root);
  await fs.mkdir(scope.normalizedDir, { recursive: true });
  const targetPath = path.join(scope.normalizedDir, "target.md");
  await fs.copyFile("data/demo/target/batch-record.md", targetPath);
  const ruleset: Ruleset = {
    rulesetId: "RULESET-SOP-DEMO-001",
    sopDocumentId: "SOP-DEMO-001",
    sopFileName: "document-control-sop.md",
    title: "Rules",
    status: "approved",
    generatedAt: "now",
    rules: [sampleRule("approved")]
  };
  await writeJson(path.join(scope.rulesetsApprovedDir, `${ruleset.rulesetId}.json`), ruleset);

  const result = await runQc(targetPath, new AcceptedFindingProvider(), scope);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.finalDecision, "REJECT");
});

test("QC case run preserves supporting source evidence citations", async () => {
  const root = ".tmp/qc-case/data/clients";
  await fs.rm(".tmp/qc-case", { recursive: true, force: true });
  const scope = resolveClientScope("alpha", root);
  await fs.mkdir(scope.normalizedDir, { recursive: true });
  const targetPath = path.join(scope.normalizedDir, "target.md");
  const evidencePath = path.join(scope.normalizedDir, "evidence.md");
  await fs.writeFile(targetPath, "# Target\n\nDocument Number: BMR-001\n", "utf8");
  await fs.writeFile(evidencePath, "# Workbook: Evidence.xlsx\n\nA1: Release metadata reviewed\n", "utf8");
  const ruleset: Ruleset = {
    rulesetId: "RULESET-SOP-DEMO-001",
    sopDocumentId: "SOP-DEMO-001",
    sopFileName: "document-control-sop.md",
    title: "Rules",
    status: "approved",
    generatedAt: "now",
    rules: [sampleRule("approved")]
  };
  await writeJson(path.join(scope.rulesetsApprovedDir, `${ruleset.rulesetId}.json`), ruleset);

  const result = await runQcCase({ targetPath, evidenceMode: "explicit", evidencePaths: [evidencePath] }, new CaseFindingProvider(), scope);
  const graph = await new GraphStore(scope.graphPath).load();
  assert.equal(result.accepted.length, 1);
  assert.equal(result.finalDecision, "REJECT");
  assert.equal(result.accepted[0]?.evidenceSources?.[0]?.documentId, "EVIDENCE-EVIDENCE");
  assert.ok(graph.nodes.some((node) => node.type === "SOURCE_DOCUMENT" && node.id === "EVIDENCE-EVIDENCE"));
  assert.ok(graph.edges.some((edge) => edge.type === "SUPPORTED_BY_SOURCE" && edge.from === "QC-CASE-F-001"));
});

test("graph serialization and finding lineage resolve", async () => {
  const filePath = ".tmp/test-graph.json";
  await fs.rm(filePath, { force: true });
  const graph = new GraphStore(filePath);
  const sop = await adapter.parse("data/demo/sop/document-control-sop.md", "sop");
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  const ruleset: Ruleset = { rulesetId: "RULESET-SOP-DEMO-001", sopDocumentId: sop.documentId, sopFileName: sop.fileName, title: "Rules", status: "approved", generatedAt: "now", rules: [sampleRule("approved")] };
  const finding = sampleFinding();
  finding.decision = "ACCEPTED";
  await graph.addDocument(sop);
  await graph.addDocument(target);
  await graph.addRuleset(ruleset);
  await graph.addFindings([finding]);
  const lineage = await graph.getLineageForFinding("QC-F-001");
  assert.equal(lineage.rule?.id, "SOP-DEMO-001-R004");
  assert.equal(lineage.ruleset?.id, "RULESET-SOP-DEMO-001");
  assert.equal(lineage.sop?.id, "SOP-DEMO-001");
  assert.equal(lineage.target?.id, "TARGET-DEMO-001");
});

test("provider mock can run without Gemini", async () => {
  const provider = new MockAIProvider();
  const result = await provider.generateStructured<{ rules: SopRule[] }>({ runId: "x", guideId: "g", guideVersion: "1", schemaName: "sop-rule-candidates", system: "", prompt: "" });
  assert.equal(result.provider, "mock");
  assert.equal(result.parsed.rules.length, 6);
});

test("demo fixtures produce expected deterministic structure", async () => {
  const sop = await adapter.parse("data/demo/sop/document-control-sop.md", "sop");
  const target = await adapter.parse("data/demo/target/batch-record.md", "target");
  assert.equal(sop.blocks[0]?.blockId, "SOP-DEMO-001-B001");
  assert.equal(target.blocks[0]?.blockId, "TARGET-DEMO-001-B001");
});
