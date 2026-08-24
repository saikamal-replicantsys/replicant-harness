import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentEvaluationResult, MetricResult } from "../contracts/evaluation-result.js";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function metricRow(name: string, metric: MetricResult): string {
  return `| ${name} | ${metric.display} |`;
}

function cappedList(items: string[], empty: string, limit = 10): string {
  if (items.length === 0) return empty;
  const shown = items.slice(0, limit).map((item) => `- ${item}`).join("\n");
  const suffix = items.length > limit ? `\n- ... ${items.length - limit} more omitted` : "";
  return `${shown}${suffix}`;
}

export function buildMarkdownReport(result: DocumentEvaluationResult): string {
  const numeric = result.metrics.numericFidelity.details as { referenceFacts?: number; matched?: number } | undefined;
  const units = result.metrics.unitFidelity.details as { referenceUnits?: number; matched?: number } | undefined;
  const tables = result.metrics.tableFidelity.details as { referenceTables?: number; matchedTables?: number } | undefined;
  const completeness = result.metrics.completeness.details as { referenceSentences?: number; coveredSentences?: number } | undefined;

  return `# RepliSense Document Evaluation Report

## Summary

| Metric | Result |
|---|---|
| Overall Score | ${result.overallScore.toFixed(1)} / 100 |
| Decision | ${result.decision} |
| Critical Issues | ${result.criticalIssues.length} |
| Reference | ${result.reference.fileName} |
| Generated | ${result.generated.fileName} |

## Text Similarity

| Metric | Result |
|---|---|
${metricRow("Character Levenshtein", result.metrics.characterLevenshtein)}
${metricRow("Word Levenshtein", result.metrics.wordLevenshtein)}
${metricRow("ROUGE-1", result.metrics.rouge1)}
${metricRow("ROUGE-2", result.metrics.rouge2)}
${metricRow("ROUGE-L", result.metrics.rougeL)}
${metricRow("TF-IDF Cosine", result.metrics.tfidfCosine)}

## Structure

| Metric | Result |
|---|---|
${metricRow("Section Coverage", result.metrics.sectionCoverage)}
${metricRow("Heading Coverage", result.metrics.headingCoverage)}
${metricRow("Section Order", result.metrics.sectionOrder)}

## Factual Fidelity

| Metric | Result |
|---|---|
| Numbers Matched | ${numeric?.matched ?? 0} / ${numeric?.referenceFacts ?? 0} |
| Numeric Fidelity | ${result.metrics.numericFidelity.display} |
| Units Matched | ${units?.matched ?? 0} / ${units?.referenceUnits ?? 0} |
| Unit Fidelity | ${result.metrics.unitFidelity.display} |
| Formula Fidelity | ${result.metrics.formulaFidelity.display} |

## Tables

| Metric | Result |
|---|---|
| Reference Tables | ${tables?.referenceTables ?? 0} |
| Matched Tables | ${tables?.matchedTables ?? 0} |
| Table Fidelity | ${result.metrics.tableFidelity.display} |

## Completeness

| Metric | Result |
|---|---|
| Covered Sentences | ${completeness?.coveredSentences ?? 0} / ${completeness?.referenceSentences ?? 0} |
| Completeness Score | ${result.metrics.completeness.display} |

## Section Breakdown

| Section | Generated Match | Text | Numbers | Units | Completeness |
|---|---|---:|---:|---:|---:|
${result.sectionResults.map((section) => `| ${section.heading} | ${section.generatedHeading ?? "Not matched"} | ${percent(section.textSimilarity)} | ${percent(section.numericFidelity)} | ${percent(section.unitFidelity)} | ${percent(section.completeness)} |`).join("\n")}

## Critical Issues

${result.criticalIssues.length === 0 ? "None." : result.criticalIssues.map((issue) => `- **${issue.type}**: ${issue.message}`).join("\n")}

## Potentially Missing Content

${cappedList(result.potentiallyMissingContent, "None detected.")}

## Potentially Unsupported / Extra Content

${cappedList(result.potentiallyExtraContent, "None detected.")}
`;
}

export async function writeReports(result: DocumentEvaluationResult, reportsDir = "reports") {
  await fs.mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "latest.json");
  const mdPath = path.join(reportsDir, "latest.md");
  await fs.writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await fs.writeFile(mdPath, buildMarkdownReport(result), "utf8");
  return { jsonPath, mdPath };
}
