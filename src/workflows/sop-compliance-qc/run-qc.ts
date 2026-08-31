import fs from "node:fs/promises";
import path from "node:path";
import type { AIProvider } from "../../providers/provider.js";
import { MarkdownDocumentAdapter } from "../../documents/markdown.adapter.js";
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

export async function runQc(targetPath: string, provider: AIProvider): Promise<QcRunResult> {
  const startedAt = new Date().toISOString();
  const runId = `QC-RUN-${Date.now()}`;
  const adapter = new MarkdownDocumentAdapter();
  const target = await adapter.parse(targetPath, "target");
  await writeJson(path.join("data/normalized/target", `${target.documentId}.json`), target);

  const approvedRules = await loadApprovedRules();
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

  const graph = new GraphStore();
  await graph.addDocument(target);
  const findings = response.parsed.findings.map((finding, index) => ({
    ...finding,
    runId,
    findingId: finding.findingId || `QC-F-${String(index + 1).padStart(3, "0")}`
  }));

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
  await buildFindingProvenance(finalFindings);

  const accepted = finalFindings.filter((finding) => finding.decision === "ACCEPTED");
  const humanReview = finalFindings.filter((finding) => finding.decision === "HUMAN_REVIEW");
  const rejected = finalFindings.filter((finding) => finding.decision === "REJECTED");
  const baseName = path.basename(targetPath, path.extname(targetPath));
  const findingsPath = await writeJson(path.join("data/findings", `${baseName}.findings.json`), { runId, findings: finalFindings });
  const oldQcPath = await writeJson(path.join("data/findings", `${baseName}.old-qc.json`), toConceptualOldQc(finalFindings));
  const reportPath = path.join("data/reports", `${baseName}-qc-report.md`);
  await writeJson(path.join("data/findings", `${baseName}.human-review.json`), humanReview);
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
  });

  return { runId, findings: finalFindings, accepted, humanReview, rejected, reportPath, findingsPath, oldQcPath, tracePath };
}
