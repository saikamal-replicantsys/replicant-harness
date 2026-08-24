import fs from "node:fs/promises";
import path from "node:path";
import { evaluateDocuments } from "./evaluate-documents.js";

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2 : sorted[mid] ?? 0;
}

async function main(): Promise<void> {
  const casesRoot = "evals/cases";
  await fs.mkdir("reports", { recursive: true });
  const entries = await fs.readdir(casesRoot, { withFileTypes: true }).catch(() => []);
  const caseDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(casesRoot, entry.name));

  if (caseDirs.length === 0) {
    throw new Error("No batch cases found under evals/cases. Add case folders with reference.docx and generated.docx.");
  }

  const results = [];
  for (const caseDir of caseDirs) {
    console.log(`Evaluating ${caseDir}...`);
    results.push({
      caseId: path.basename(caseDir),
      result: await evaluateDocuments(path.join(caseDir, "reference.docx"), path.join(caseDir, "generated.docx"))
    });
  }

  const scores = results.map((item) => item.result.overallScore);
  const summary = {
    timestamp: new Date().toISOString(),
    cases: results.length,
    passed: results.filter((item) => item.result.decision === "PASS").length,
    review: results.filter((item) => item.result.decision === "REVIEW").length,
    failed: results.filter((item) => item.result.decision === "FAIL").length,
    averageScore: scores.reduce((sum, score) => sum + score, 0) / scores.length,
    medianScore: median(scores),
    results
  };

  await fs.writeFile("reports/batch-latest.json", `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  await fs.writeFile("reports/batch-latest.md", `# RepliSense Batch Evaluation

| Metric | Result |
|---|---:|
| Cases | ${summary.cases} |
| Passed | ${summary.passed} |
| Review | ${summary.review} |
| Failed | ${summary.failed} |
| Average score | ${summary.averageScore.toFixed(1)} |
| Median score | ${summary.medianScore.toFixed(1)} |

| Case | Score | Decision |
|---|---:|---|
${results.map((item) => `| ${item.caseId} | ${item.result.overallScore.toFixed(1)} | ${item.result.decision} |`).join("\n")}
`, "utf8");

  console.log("");
  console.log(`Cases: ${summary.cases}`);
  console.log(`Passed: ${summary.passed}`);
  console.log(`Review: ${summary.review}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Average score: ${summary.averageScore.toFixed(1)}`);
  console.log(`Median score: ${summary.medianScore.toFixed(1)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
