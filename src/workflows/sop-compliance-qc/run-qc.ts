import fs from "node:fs/promises";
import path from "node:path";
import { assertPathInside } from "../../client/client-scope.js";
import type { ClientScope } from "../../client/client-scope.js";
import type { AIProvider } from "../../providers/provider.js";
import { MarkdownDocumentAdapter } from "../../documents/markdown.adapter.js";
import type { QcFinding } from "../../harness/contracts/finding.js";
import type { FindingCandidateResponse } from "./workflow.types.js";
import type { QcRunResult } from "./workflow.types.js";
import { loadApprovedRules, writeJson } from "./store.js";
import { SimpleRuleRetriever } from "../../knowledge/retrieval.js";
import { evaluateFindingGrounding } from "./evaluators.js";
import { validateFindings } from "../../harness/sensors/finding-sensors.js";
import { GraphStore } from "../../knowledge/graph.store.js";
import { buildFindingProvenance } from "./build-provenance.js";
import { buildClientReport } from "./build-report.js";
import { toConceptualOldQc } from "../../adapters/old-qc-output.adapter.js";
import { writeTrace } from "../../harness/tracing/trace.js";
import { findingsSchema } from "../../providers/structured-schemas.js";

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function coerceFinding(candidate: Partial<QcFinding>, runId: string, index: number): QcFinding {
  const raw = asRecord(candidate);
  const target = asRecord(raw.target);
  const rule = asRecord(raw.rule);
  const sopSource = asRecord(raw.sopSource);
  const explanation = asRecord(raw.explanation);
  const evaluation = asRecord(raw.evaluation);

  return {
    findingId: typeof raw.findingId === "string" && raw.findingId ? raw.findingId : `QC-F-${String(index + 1).padStart(3, "0")}`,
    runId,
    status: "open",
    decision: raw.decision === "ACCEPTED" || raw.decision === "REJECTED" ? raw.decision : "HUMAN_REVIEW",
    severity: raw.severity === "critical" || raw.severity === "major" || raw.severity === "minor" ? raw.severity : "minor",
    title: typeof raw.title === "string" ? raw.title : "Malformed candidate finding",
    description: typeof raw.description === "string" ? raw.description : "The provider returned an incomplete finding object.",
    target: {
      documentId: typeof target.documentId === "string" ? target.documentId : "",
      blockIds: asStringArray(target.blockIds),
      section: typeof target.section === "string" ? target.section : undefined,
      observedText: typeof target.observedText === "string" ? target.observedText : ""
    },
    rule: {
      ruleId: typeof rule.ruleId === "string" ? rule.ruleId : "",
      rulesetId: typeof rule.rulesetId === "string" ? rule.rulesetId : "",
      title: typeof rule.title === "string" ? rule.title : ""
    },
    sopSource: {
      documentId: typeof sopSource.documentId === "string" ? sopSource.documentId : "",
      documentName: typeof sopSource.documentName === "string" ? sopSource.documentName : "",
      section: typeof sopSource.section === "string" ? sopSource.section : undefined,
      sourceBlockIds: asStringArray(sopSource.sourceBlockIds),
      sourceText: typeof sopSource.sourceText === "string" ? sopSource.sourceText : undefined
    },
    explanation: {
      expected: typeof explanation.expected === "string" ? explanation.expected : "",
      observed: typeof explanation.observed === "string" ? explanation.observed : "",
      reason: typeof explanation.reason === "string" ? explanation.reason : "Provider output was incomplete."
    },
    evaluation: {
      ruleExists: evaluation.ruleExists === true,
      ruleApproved: evaluation.ruleApproved === true,
      ruleGrounded: evaluation.ruleGrounded === true,
      findingGrounded: evaluation.findingGrounded === true,
      provenanceValid: evaluation.provenanceValid === true,
      score: typeof evaluation.score === "number" ? evaluation.score : 0,
      reason: typeof evaluation.reason === "string" ? evaluation.reason : undefined
    }
  };
}

export async function runQc(targetPath: string, provider: AIProvider, scope?: ClientScope): Promise<QcRunResult> {
  if (scope) assertPathInside(targetPath, scope.normalizedDir);
  const startedAt = new Date().toISOString();
  const runId = `QC-RUN-${Date.now()}`;
  const adapter = new MarkdownDocumentAdapter();
  const target = await adapter.parse(targetPath, { documentType: "target", clientId: scope?.clientId, normalizedFile: targetPath });
  await writeJson(path.join(scope?.normalizedDir ?? "data/normalized/target", `${target.documentId}.json`), target);

  const approvedRules = await loadApprovedRules(scope);
  if (approvedRules.length === 0) throw new Error("No approved rules found. Run rules, then approve-rules before QC.");
  const retrieved = await new SimpleRuleRetriever().retrieve(target, approvedRules);
  const response = await provider.generateStructured<FindingCandidateResponse>({
    runId,
    guideId: "sop-compliance-qc",
    guideVersion: "1.0.0",
    schemaName: "qc-finding-candidates",
    schema: findingsSchema,
    system: "Generate candidate QC findings using only supplied approved rules. Return structured JSON only.",
    prompt: JSON.stringify({ targetDocument: target, approvedRules: retrieved.map((item) => item.rule) })
  });

  const graph = new GraphStore(scope?.graphPath);
  await graph.addDocument(target);
  const findings = response.parsed.findings.map((finding, index) => coerceFinding(finding, runId, index));

  for (const finding of findings) {
    const rule = approvedRules.find((candidate) => candidate.ruleId === finding.rule.ruleId);
    if (!rule) continue;
    const sopEvidence = rule.source.sourceBlockIds.map((blockId) => ({ blockId, type: "paragraph" as const, text: rule.source.sourceText, location: { section: rule.source.section, blockId } }));
    const targetEvidence = target.blocks.filter((block) => finding.target.blockIds.includes(block.blockId));
    const grounding = await evaluateFindingGrounding(provider, finding, rule, sopEvidence, targetEvidence);
    finding.evaluation.findingGrounded = grounding.supported && grounding.ruleAppliedCorrectly && grounding.targetEvidenceSupportsFinding && grounding.score >= 0.85;
    finding.evaluation.reason = grounding.reason;
  }

  const validations = validateFindings(findings, approvedRules, target);
  const finalFindings = validations.map((validation) => validation.finding);
  await buildFindingProvenance(finalFindings, graph);

  const accepted = finalFindings.filter((finding) => finding.decision === "ACCEPTED");
  const humanReview = finalFindings.filter((finding) => finding.decision === "HUMAN_REVIEW");
  const rejected = finalFindings.filter((finding) => finding.decision === "REJECTED");
  const baseName = path.basename(targetPath, path.extname(targetPath));
  const findingsDir = scope?.findingsDir ?? "data/findings";
  const reportsDir = scope?.reportsDir ?? "data/reports";
  const findingsPath = await writeJson(path.join(findingsDir, `${baseName}.findings.json`), { runId, findings: finalFindings });
  const oldQcPath = await writeJson(path.join(findingsDir, `${baseName}.old-qc.json`), toConceptualOldQc(finalFindings));
  const reportPath = path.join(reportsDir, `${baseName}-qc-report.md`);
  await writeJson(path.join(findingsDir, `${baseName}.human-review.json`), humanReview);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, buildClientReport({
    targetTitle: target.title,
    rulesetsLoaded: new Set(approvedRules.map((rule) => rule.rulesetId)).size,
    rulesEvaluated: retrieved.length,
    accepted,
    humanReview,
    approvedRules
  }), "utf8");

  const tracePath = await writeTrace({
    runId,
    workflow: "sop.compliance_qc",
    provider: response.provider,
    model: response.model,
    startedAt,
    completedAt: new Date().toISOString(),
    guideVersions: { "sop-compliance-qc": "1.0.0" },
    rulesetsLoaded: new Set(approvedRules.map((rule) => rule.rulesetId)).size,
    approvedRulesLoaded: approvedRules.length,
    rulesRetrieved: retrieved.length,
    candidateFindings: findings.length,
    acceptedFindings: accepted.length,
    humanReviewFindings: humanReview.length,
    rejectedFindings: rejected.length,
    sensors: validations.flatMap((validation) => validation.sensors),
    evidenceIds: finalFindings.flatMap((finding) => [...finding.sopSource.sourceBlockIds, ...finding.target.blockIds]),
    ruleIds: finalFindings.map((finding) => finding.rule.ruleId),
    finalDecision: humanReview.length > 0 ? "HUMAN_REVIEW" : "ACCEPT"
  }, scope?.tracesDir);

  return { runId, findings: finalFindings, accepted, humanReview, rejected, reportPath, findingsPath, oldQcPath, tracePath };
}
