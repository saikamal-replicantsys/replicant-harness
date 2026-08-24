import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { DocumentEvaluationResult, MetricResult, SectionEvaluation } from "../contracts/evaluation-result.js";
import type { ExtractedSection } from "../contracts/extracted-document.js";
import { alignSections } from "./align-sections.js";
import { extractDocument } from "./extract-document.js";
import { normalizeForComparison, tokenize } from "./normalize-document.js";
import { characterLevenshtein, wordLevenshtein } from "../sensors/text-similarity/levenshtein.js";
import { rougeL, rougeN } from "../sensors/text-similarity/rouge.js";
import { tfidfCosineSimilarity } from "../sensors/text-similarity/tfidf.js";
import { headingCoverage, sectionCoverage } from "../sensors/structure/sections.js";
import { sectionOrderScore } from "../sensors/structure/order.js";
import { numericFidelity, unitFidelity } from "../sensors/factual/numbers.js";
import { formulaFidelity } from "../sensors/factual/formulas.js";
import { tableFidelity } from "../sensors/tables/table-fidelity.js";
import { completeness } from "../sensors/completeness/completeness.js";
import { calculateOverallScore, decide } from "../scoring/scoring-engine.js";
import { criticalRules } from "../scoring/scoring.config.js";
import { writeReports } from "./build-report.js";

function percent(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

function metric(score: number, details?: unknown): MetricResult {
  return { score, display: percent(score), details };
}

async function ensureDocx(filePath: string, label: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) throw new Error(`${label} is not a file: ${filePath}`);
  } catch {
    throw new Error(`${label} DOCX not found: ${filePath}`);
  }
  if (path.extname(filePath).toLowerCase() !== ".docx") {
    throw new Error(`${label} must be a .docx file: ${filePath}`);
  }
}

function sectionTextSimilarity(reference?: ExtractedSection, generated?: ExtractedSection): number {
  if (!reference || !generated) return 0;
  return rougeL(tokenize(reference.content), tokenize(generated.content));
}

function sectionEvaluations(alignments: ReturnType<typeof alignSections>): SectionEvaluation[] {
  return alignments.map((alignment) => {
    const referenceText = alignment.referenceSection.content;
    const generatedText = alignment.generatedSection?.content ?? "";
    return {
      heading: alignment.referenceHeading,
      generatedHeading: alignment.generatedHeading,
      alignmentConfidence: alignment.confidence,
      textSimilarity: sectionTextSimilarity(alignment.referenceSection, alignment.generatedSection),
      numericFidelity: numericFidelity(referenceText, generatedText).score,
      unitFidelity: unitFidelity(referenceText, generatedText).score,
      completeness: referenceText.trim() ? completeness([alignment]).score : 1
    };
  });
}

export async function evaluateDocuments(referencePath: string, generatedPath: string): Promise<DocumentEvaluationResult> {
  await ensureDocx(referencePath, "Reference");
  await ensureDocx(generatedPath, "Generated");

  console.log("Extracting reference document...");
  const reference = await extractDocument(referencePath);
  console.log("✓ Extracted reference document");
  console.log("Extracting generated document...");
  const generated = await extractDocument(generatedPath);
  console.log("✓ Extracted generated document");

  const referenceText = normalizeForComparison(reference.fullText);
  const generatedText = normalizeForComparison(generated.fullText);
  const referenceTokens = tokenize(reference.fullText);
  const generatedTokens = tokenize(generated.fullText);
  const alignments = alignSections(reference.sections, generated.sections);
  console.log(`✓ Aligned ${alignments.length} sections`);

  const charLev = characterLevenshtein(referenceText, generatedText);
  const wordLev = wordLevenshtein(referenceTokens, generatedTokens);
  const sections = sectionCoverage(reference.sections, generated.sections);
  const headings = headingCoverage(reference.headings, generated.headings);
  const order = sectionOrderScore(alignments);
  const numeric = numericFidelity(reference.fullText, generated.fullText);
  const units = unitFidelity(reference.fullText, generated.fullText);
  const formulas = formulaFidelity(reference.fullText, generated.fullText);
  const tables = tableFidelity(reference.tables, generated.tables);
  const complete = completeness(alignments);

  const criticalIssues = [...numeric.criticalIssues];
  if (criticalRules.missingTopLevelSection) {
    for (const missing of sections.missing) {
      const missingSection = reference.sections.find((section) => section.heading === missing);
      if ((missingSection?.level ?? 1) <= 1) {
        criticalIssues.push({
          type: "missing_top_level_section",
          severity: "critical",
          message: `Missing top-level section "${missing}".`,
          reference: missingSection
        });
      }
    }
  }

  const metrics: DocumentEvaluationResult["metrics"] = {
    characterLevenshtein: metric(charLev.normalizedSimilarity, charLev),
    wordLevenshtein: metric(wordLev.normalizedSimilarity, wordLev),
    rouge1: metric(rougeN(referenceTokens, generatedTokens, 1)),
    rouge2: metric(rougeN(referenceTokens, generatedTokens, 2)),
    rougeL: metric(rougeL(referenceTokens, generatedTokens)),
    tfidfCosine: metric(tfidfCosineSimilarity(referenceTokens, generatedTokens)),
    sectionCoverage: metric(sections.score, sections),
    headingCoverage: metric(headings.score, headings),
    sectionOrder: metric(order.score, order),
    numericFidelity: metric(numeric.score, numeric),
    unitFidelity: metric(units.score, units),
    formulaFidelity: metric(formulas.score, formulas),
    tableFidelity: metric(tables.score, tables),
    completeness: metric(complete.score, complete)
  };
  console.log("✓ Ran 12 evaluation sensors");

  const partial: DocumentEvaluationResult = {
    runId: `doc-eval-${Date.now()}`,
    timestamp: new Date().toISOString(),
    reference: { path: path.resolve(referencePath), fileName: reference.fileName },
    generated: { path: path.resolve(generatedPath), fileName: generated.fileName },
    overallScore: 0,
    decision: "FAIL",
    metrics,
    sectionResults: sectionEvaluations(alignments),
    criticalIssues,
    potentiallyMissingContent: complete.potentiallyMissing,
    potentiallyExtraContent: complete.potentiallyExtra
  };

  partial.overallScore = calculateOverallScore(metrics);
  partial.decision = decide(partial.overallScore, criticalIssues);
  return partial;
}

export function printSummary(result: DocumentEvaluationResult): void {
  const numeric = result.metrics.numericFidelity.details as { referenceFacts: number; matched: number };
  const units = result.metrics.unitFidelity.details as { referenceUnits: number; matched: number };
  const tables = result.metrics.tableFidelity.details as { referenceTables: number; matchedTables: number };

  console.log("");
  console.log("RepliSense Document Evaluation");
  console.log("===============================");
  console.log("");
  console.log(`Reference: ${result.reference.fileName}`);
  console.log(`Generated: ${result.generated.fileName}`);
  console.log("");
  console.log(`Overall Fidelity Score: ${result.overallScore.toFixed(1)} / 100`);
  console.log(`Decision: ${result.decision}`);
  console.log("");
  console.log("Text Metrics");
  console.log("------------");
  console.log(`Levenshtein similarity     ${result.metrics.characterLevenshtein.display}`);
  console.log(`Word Levenshtein           ${result.metrics.wordLevenshtein.display}`);
  console.log(`ROUGE-1                    ${result.metrics.rouge1.display}`);
  console.log(`ROUGE-2                    ${result.metrics.rouge2.display}`);
  console.log(`ROUGE-L                    ${result.metrics.rougeL.display}`);
  console.log(`TF-IDF cosine              ${result.metrics.tfidfCosine.display}`);
  console.log("");
  console.log("Structure");
  console.log("---------");
  console.log(`Section coverage           ${result.metrics.sectionCoverage.display}`);
  console.log(`Heading coverage           ${result.metrics.headingCoverage.display}`);
  console.log(`Section order              ${result.metrics.sectionOrder.display}`);
  console.log("");
  console.log("Factual Fidelity");
  console.log("----------------");
  console.log(`Numbers matched            ${numeric.matched} / ${numeric.referenceFacts}`);
  console.log(`Units matched              ${units.matched} / ${units.referenceUnits}`);
  console.log(`Numeric fidelity           ${result.metrics.numericFidelity.display}`);
  console.log(`Unit fidelity              ${result.metrics.unitFidelity.display}`);
  console.log("");
  console.log("Tables");
  console.log("------");
  console.log(`Reference tables           ${tables.referenceTables}`);
  console.log(`Matched tables             ${tables.matchedTables}`);
  console.log(`Table fidelity             ${result.metrics.tableFidelity.display}`);
  console.log("");
  console.log("Completeness");
  console.log("------------");
  console.log(`Completeness score         ${result.metrics.completeness.display}`);
  console.log("");
  console.log(`FINAL: ${result.decision}`);
}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const [referenceArg, generatedArg] = args;
  const referencePath = referenceArg ?? "eval-input/reference.docx";
  const generatedPath = generatedArg ?? "eval-input/generated.docx";
  const result = await evaluateDocuments(referencePath, generatedPath);
  const reports = await writeReports(result);
  console.log(`✓ Generated ${reports.jsonPath}`);
  console.log(`✓ Generated ${reports.mdPath}`);
  printSummary(result);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runCli().catch((error: unknown) => {
    console.error("");
    console.error("Document evaluation failed");
    console.error("==========================");
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
