import { createProvider } from "../providers/provider-factory.js";
import { runQcCase } from "../workflows/sop-compliance-qc/run-qc-case.js";
import { inferLeadingClientArg, parseClientArg, resolveClientScope } from "../client/client-scope.js";

function readOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${name}`);
  args.splice(index, 2);
  return value;
}

function readManyAfter(args: string[], name: string): string[] | "all" | undefined {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const values = args.slice(index + 1);
  args.splice(index);
  if (values.length === 0) throw new Error(`Missing value for ${name}`);
  if (values.length === 1 && values[0] === "all") return "all";
  return values;
}

async function main(): Promise<void> {
  const parsed = parseClientArg(process.argv.slice(2));
  const inferred = parsed.clientId ? parsed : inferLeadingClientArg(parsed.rest);
  const clientId = inferred.clientId;
  const rest = [...inferred.rest];
  if (!clientId) throw new Error("Usage: npm run qc:case -- --client <client-id> --target <target-doc-or-md> [--evidence all|<evidence-files...>]");
  const npmTarget = process.env.npm_config_target;
  const configuredTarget = npmTarget && npmTarget !== "true" && npmTarget !== "false" ? npmTarget : undefined;
  let targetPath = readOption(rest, "--target") ?? configuredTarget;
  if (targetPath) {
    const forwardedIndex = rest.indexOf(targetPath);
    if (forwardedIndex !== -1) rest.splice(forwardedIndex, 1);
  } else {
    targetPath = rest.shift();
  }
  let evidence = readManyAfter(rest, "--evidence");
  const npmEvidence = process.env.npm_config_evidence;
  if (!evidence && npmEvidence && npmEvidence !== "true" && npmEvidence !== "false") {
    evidence = npmEvidence === "all" ? "all" : [npmEvidence];
    const forwardedIndex = rest.indexOf(npmEvidence);
    if (forwardedIndex !== -1) rest.splice(forwardedIndex, 1);
  }
  if (!evidence && rest.length > 0) {
    evidence = rest.length === 1 && rest[0] === "all" ? "all" : [...rest];
    rest.splice(0);
  }
  if (!targetPath || rest.length > 0) throw new Error("Usage: npm run qc:case -- --client <client-id> --target <target-doc-or-md> [--evidence all|<evidence-files...>]");

  const result = await runQcCase({
    targetPath,
    evidenceMode: evidence && evidence !== "all" ? "explicit" : "all",
    evidencePaths: Array.isArray(evidence) ? evidence : undefined
  }, createProvider(), resolveClientScope(clientId));

  console.log("SOP Compliance QC case complete");
  console.log(`Client: ${clientId}`);
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
