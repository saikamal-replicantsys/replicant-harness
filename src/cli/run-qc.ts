import { createProvider } from "../providers/provider-factory.js";
import { runQc } from "../workflows/sop-compliance-qc/run-qc.js";
import { inferLeadingClientArg, parseClientArg, resolveClientScope } from "../client/client-scope.js";

async function main(): Promise<void> {
  const parsed = parseClientArg(process.argv.slice(2));
  const inferred = parsed.clientId ? parsed : inferLeadingClientArg(parsed.rest);
  const clientId = inferred.clientId;
  const rest = inferred.rest;
  const targetPath = rest[0];
  if (!targetPath) throw new Error("Usage: npm run qc -- [--client <client-id>] <path-to-target.md>");
  const result = await runQc(targetPath, createProvider(), clientId ? resolveClientScope(clientId) : undefined);
  console.log("SOP Compliance QC complete");
  if (clientId) console.log(`Client: ${clientId}`);
  console.log(`Accepted findings: ${result.accepted.length}`);
  console.log(`Human review findings: ${result.humanReview.length}`);
  console.log(`Rejected findings: ${result.rejected.length}`);
  console.log(`Final decision: ${result.finalDecision}`);
  console.log(`Findings JSON: ${result.findingsPath}`);
  console.log(`Client report: ${result.reportPath}`);
  console.log(`Old QC adapter: ${result.oldQcPath}`);
  console.log(`Trace: ${result.tracePath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
