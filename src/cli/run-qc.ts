import { createProvider } from "../providers/provider-factory.js";
import { runQc } from "../workflows/sop-compliance-qc/run-qc.js";

async function main(): Promise<void> {
  const targetPath = process.argv[2];
  if (!targetPath) throw new Error("Usage: npm run qc -- <path-to-target.md>");
  const result = await runQc(targetPath, createProvider());
  console.log("SOP Compliance QC complete");
  console.log(`Accepted findings: ${result.accepted.length}`);
  console.log(`Human review findings: ${result.humanReview.length}`);
  console.log(`Rejected findings: ${result.rejected.length}`);
  console.log(`Findings JSON: ${result.findingsPath}`);
  console.log(`Client report: ${result.reportPath}`);
  console.log(`Old QC adapter: ${result.oldQcPath}`);
  console.log(`Trace: ${result.tracePath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
