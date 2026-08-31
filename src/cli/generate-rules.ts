import { createProvider } from "../providers/provider-factory.js";
import { generateRules } from "../workflows/sop-compliance-qc/generate-rules.js";
import { inferLeadingClientArg, parseClientArg, resolveClientScope } from "../client/client-scope.js";

async function main(): Promise<void> {
  const parsed = parseClientArg(process.argv.slice(2));
  const inferred = parsed.clientId ? parsed : inferLeadingClientArg(parsed.rest);
  const clientId = inferred.clientId;
  const rest = inferred.rest;
  const sopPath = rest[0];
  if (!sopPath) throw new Error("Usage: npm run rules -- [--client <client-id>] <path-to-sop.md>");
  const result = await generateRules(sopPath, createProvider(), clientId ? resolveClientScope(clientId) : undefined);
  console.log("Rule generation complete");
  if (clientId) console.log(`Client: ${clientId}`);
  console.log(`Ruleset: ${result.ruleset.rulesetId}`);
  console.log(`Candidate rules: ${result.ruleset.rules.length}`);
  console.log(`Generated ruleset: ${result.generatedPath}`);
  console.log(`Trace: ${result.tracePath}`);
  console.log("Final decision: AWAITING_HUMAN_APPROVAL");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
