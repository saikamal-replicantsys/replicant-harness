import fs from "node:fs/promises";
import path from "node:path";
import { assertPathInside } from "../../client/client-scope.js";
import type { ClientScope } from "../../client/client-scope.js";
import type { AIProvider } from "../../providers/provider.js";
import { MarkdownDocumentAdapter } from "../../documents/markdown.adapter.js";
import { normalizeSourceFile } from "../../client/ingest-client.js";
import { defaultDocumentAdapters } from "../../documents/adapters.js";
import type { NormalizedBlock, NormalizedDocument } from "../../harness/contracts/normalized-document.js";
import type { QcFinding } from "../../harness/contracts/finding.js";
import type { FindingCandidateResponse, QcRunResult } from "./workflow.types.js";
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
import { coerceFinding, qcFinalDecision } from "./run-qc.js";
import { loadSopQcRuntimeConfig } from "./qc-config.js";

export interface QcCaseRunOptions {
  targetPath: string;
  evidencePaths?: string[];
  evidenceMode?: "all" | "explicit";
}

function chunks<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) batches.push(items.slice(index, index + size));
  return batches;
}

async function metadataFileType(markdownPath: string): Promise<string | undefined> {
  const metadataPath = markdownPath.replace(/\.md$/i, ".metadata.json");
  try {
    const parsed = JSON.parse(await fs.readFile(metadataPath, "utf8")) as { fileType?: string };
    return parsed.fileType;
  } catch {
    return undefined;
  }
}

async function markdownFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md")).map((entry) => path.join(dir, entry.name));
}

async function normalizeTargetIfNeeded(targetPath: string, scope: ClientScope): Promise<string> {
  const ext = path.extname(targetPath).toLowerCase();
  if (ext === ".md") {
    assertPathInside(targetPath, scope.normalizedDir);
    return targetPath;
  }
  assertPathInside(targetPath, scope.targetDir);
  const converted = await normalizeSourceFile({
    filePath: targetPath,
    outputDir: path.join(scope.normalizedDir, "target"),
    documentType: "target",
    clientId: scope.clientId,
    adapters: defaultDocumentAdapters()
  });
  return converted.normalizedFile;
}

async function normalizeEvidenceIfNeeded(evidencePath: string, scope: ClientScope): Promise<string> {
  const ext = path.extname(evidencePath).toLowerCase();
  if (ext === ".md") {
    assertPathInside(evidencePath, scope.normalizedDir);
    return evidencePath;
  }
  const outputDir = path.join(scope.normalizedDir, "evidence");
  try {
    assertPathInside(evidencePath, scope.sourceDir);
  } catch {
    try {
      assertPathInside(evidencePath, scope.evidenceDir);
    } catch {
      throw new Error(`Evidence path escapes client source/evidence scope: ${evidencePath}`);
    }
  }
  const converted = await normalizeSourceFile({
    filePath: evidencePath,
    outputDir,
    documentType: "evidence",
    clientId: scope.clientId,
    adapters: defaultDocumentAdapters()
  });
  return converted.normalizedFile;
}

async function defaultEvidencePaths(scope: ClientScope, targetMarkdownPath: string): Promise<string[]> {
  const candidates = [
    ...(await markdownFiles(scope.normalizedDir)),
    ...(await markdownFiles(path.join(scope.normalizedDir, "evidence")))
  ];
  const resolvedTarget = path.resolve(targetMarkdownPath);
  const targetBaseName = path.basename(targetMarkdownPath, path.extname(targetMarkdownPath)).toLowerCase();
  const usable: string[] = [];
  for (const candidate of candidates) {
    if (path.resolve(candidate) === resolvedTarget) continue;
    if (path.basename(candidate, path.extname(candidate)).toLowerCase() === targetBaseName) continue;
    const fileType = await metadataFileType(candidate);
    if (fileType === "yaml") continue;
    usable.push(candidate);
  }
  return Array.from(new Set(usable));
}

function combinedDocument(target: NormalizedDocument, evidenceDocuments: NormalizedDocument[]): NormalizedDocument {
  return {
    ...target,
    fullText: [target.fullText, ...evidenceDocuments.map((document) => document.fullText)].join("\n"),
    blocks: [...target.blocks, ...evidenceDocuments.flatMap((document) => document.blocks)]
  };
}

function evidenceBlocksForFinding(finding: QcFinding, evidenceDocuments: NormalizedDocument[]): NormalizedBlock[] {
  const blocksById = new Map(evidenceDocuments.flatMap((document) => document.blocks.map((block) => [block.blockId, block] as const)));
  return (finding.evidenceSources ?? []).flatMap((source) => source.blockIds.map((blockId) => blocksById.get(blockId)).filter((block): block is NormalizedBlock => Boolean(block)));
}

export async function runQcCase(options: QcCaseRunOptions, provider: AIProvider, scope: ClientScope): Promise<QcRunResult> {
  const startedAt = new Date().toISOString();
  const runId = `QC-CASE-${Date.now()}`;
  const adapter = new MarkdownDocumentAdapter();
  const targetMarkdownPath = await normalizeTargetIfNeeded(options.targetPath, scope);
  const evidenceMarkdownPaths = options.evidenceMode === "explicit"
    ? await Promise.all((options.evidencePaths ?? []).map((evidencePath) => normalizeEvidenceIfNeeded(evidencePath, scope)))
    : await defaultEvidencePaths(scope, targetMarkdownPath);

  const target = await adapter.parse(targetMarkdownPath, { documentType: "target", clientId: scope.clientId, normalizedFile: targetMarkdownPath });
  const evidenceDocuments = await Promise.all(evidenceMarkdownPaths.map((evidencePath) => adapter.parse(evidencePath, { documentType: "evidence", clientId: scope.clientId, normalizedFile: evidencePath })));
  await writeJson(path.join(scope.normalizedDir, "target", `${target.documentId}.json`), target);
  for (const document of evidenceDocuments) {
    await writeJson(path.join(scope.normalizedDir, "evidence", `${document.documentId}.json`), document);
  }

  const approvedRules = await loadApprovedRules(scope);
  if (approvedRules.length === 0) throw new Error("No approved rules found. Run rules, then approve-rules before QC.");
  const retrieved = await new SimpleRuleRetriever().retrieve(combinedDocument(target, evidenceDocuments), approvedRules);
  const config = await loadSopQcRuntimeConfig();
  const batches = chunks(retrieved.map((item) => item.rule), config.maxRulesPerQcRequest);

  const graph = new GraphStore(scope.graphPath);
  await graph.addDocument(target);
  for (const document of evidenceDocuments) await graph.addDocument(document);

  const findings: QcFinding[] = [];
  const tokenUsage: Array<{ input?: number; output?: number }> = [];
  for (const [batchIndex, rules] of batches.entries()) {
    const response = await provider.generateStructured<FindingCandidateResponse>({
      runId: `${runId}-B${String(batchIndex + 1).padStart(3, "0")}`,
      guideId: "sop-compliance-qc-case",
      guideVersion: "1.0.0",
      schemaName: "qc-finding-candidates",
      schema: findingsSchema,
      system: [
        "Generate candidate SOP compliance QC findings using only supplied approved rules, target document, and supporting source evidence.",
        "The target document is the document being QC reviewed. Supporting source evidence provides workbook/source context only.",
        "Every finding must cite an approved rule by exact ruleId and rulesetId.",
        "Every finding must cite target.blockIds from the supplied targetDocument blocks.",
        "When a finding depends on workbook/source evidence, include evidenceSources with exact documentId and blockIds.",
        "For spreadsheets, preserve sheet and cell provenance from cited evidence blocks.",
        "Every finding must cite sopSource.sourceBlockIds from the selected approved rule.",
        "If you cannot cite SOP, target, and required supporting evidence block IDs, do not create that finding.",
        "Return structured JSON only."
      ].join(" "),
      prompt: JSON.stringify({
        instruction: "Use exact IDs from the supplied JSON. Do not invent IDs. Prefer fewer high-confidence findings over broad unsupported findings.",
        targetDocument: target,
        supportingSourceDocuments: evidenceDocuments,
        approvedRules: rules
      })
    });
    if (response.tokenUsage) tokenUsage.push(response.tokenUsage);
    const candidateFindings = Array.isArray(response.parsed.findings) ? response.parsed.findings : [];
    findings.push(...candidateFindings.map((finding, index) => coerceFinding(finding, runId, findings.length + index)));
  }

  for (const finding of findings) {
    const rule = approvedRules.find((candidate) => candidate.ruleId === finding.rule.ruleId);
    if (!rule) continue;
    const sopEvidence = rule.source.sourceBlockIds.map((blockId) => ({ blockId, type: "paragraph" as const, text: rule.source.sourceText, location: { section: rule.source.section, blockId } }));
    const targetEvidence = target.blocks.filter((block) => finding.target.blockIds.includes(block.blockId));
    const sourceEvidence = evidenceBlocksForFinding(finding, evidenceDocuments);
    const grounding = await evaluateFindingGrounding(provider, finding, rule, sopEvidence, targetEvidence, sourceEvidence);
    finding.evaluation.findingGrounded = grounding.supported && grounding.ruleAppliedCorrectly && grounding.targetEvidenceSupportsFinding && grounding.score >= 0.85;
    finding.evaluation.reason = grounding.reason;
  }

  const validations = validateFindings(findings, approvedRules, target, evidenceDocuments);
  const finalFindings = validations.map((validation) => validation.finding);
  await buildFindingProvenance(finalFindings, graph);

  const accepted = finalFindings.filter((finding) => finding.decision === "ACCEPTED");
  const humanReview = finalFindings.filter((finding) => finding.decision === "HUMAN_REVIEW");
  const rejected = finalFindings.filter((finding) => finding.decision === "REJECTED");
  const finalDecision = qcFinalDecision({ accepted, humanReview, rejected });
  const baseName = path.basename(targetMarkdownPath, path.extname(targetMarkdownPath));
  const findingsPath = await writeJson(path.join(scope.findingsDir, `${baseName}.case.findings.json`), { runId, target: targetMarkdownPath, evidence: evidenceMarkdownPaths, findings: finalFindings });
  const oldQcPath = await writeJson(path.join(scope.findingsDir, `${baseName}.case.old-qc.json`), toConceptualOldQc(finalFindings));
  const reportPath = path.join(scope.reportsDir, `${baseName}-case-qc-report.md`);
  await writeJson(path.join(scope.findingsDir, `${baseName}.case.human-review.json`), humanReview);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, buildClientReport({
    targetTitle: target.title,
    evidenceTitles: evidenceDocuments.map((document) => `${document.title} (${document.fileName})`),
    rulesetsLoaded: new Set(approvedRules.map((rule) => rule.rulesetId)).size,
    rulesEvaluated: retrieved.length,
    finalDecision,
    accepted,
    humanReview,
    rejected,
    approvedRules
  }), "utf8");

  const tracePath = await writeTrace({
    runId,
    workflow: "sop.compliance_qc_case",
    provider: provider.name,
    model: provider.model,
    startedAt,
    completedAt: new Date().toISOString(),
    guideVersions: { "sop-compliance-qc-case": "1.0.0" },
    targetDocumentId: target.documentId,
    evidenceDocumentIds: evidenceDocuments.map((document) => document.documentId),
    rulesetsLoaded: new Set(approvedRules.map((rule) => rule.rulesetId)).size,
    approvedRulesLoaded: approvedRules.length,
    rulesRetrieved: retrieved.length,
    ruleBatches: batches.length,
    candidateFindings: findings.length,
    acceptedFindings: accepted.length,
    humanReviewFindings: humanReview.length,
    rejectedFindings: rejected.length,
    tokenUsage,
    sensors: validations.flatMap((validation) => validation.sensors),
    evidenceIds: finalFindings.flatMap((finding) => [
      ...finding.sopSource.sourceBlockIds,
      ...finding.target.blockIds,
      ...(finding.evidenceSources ?? []).flatMap((source) => source.blockIds)
    ]),
    ruleIds: finalFindings.map((finding) => finding.rule.ruleId),
    finalDecision
  }, scope.tracesDir);

  return { runId, finalDecision, findings: finalFindings, accepted, humanReview, rejected, reportPath, findingsPath, oldQcPath, tracePath };
}
