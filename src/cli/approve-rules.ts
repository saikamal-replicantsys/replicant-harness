import { approveRules } from "../workflows/sop-compliance-qc/approve-rules.js";
import { inferLeadingClientArg, parseClientArg, resolveClientScope } from "../client/client-scope.js";

const parsed = parseClientArg(process.argv.slice(2));
const inferred = parsed.clientId ? parsed : inferLeadingClientArg(parsed.rest);
const clientId = inferred.clientId;
const rest = inferred.rest;
const idOrPath = rest.find((arg) => arg !== "--all");
const approveAll = rest.includes("--all") || process.env.npm_config_all === "true";
if (!idOrPath) {
  console.error("Usage: npm run approve-rules -- [--client <client-id>] <ruleset-id-or-json> [--all]");
  process.exit(1);
}

approveRules(idOrPath, approveAll, clientId ? resolveClientScope(clientId) : undefined).then((result) => {
  console.log("Rule approval complete");
  if (clientId) console.log(`Client: ${clientId}`);
  console.log(`Approved: ${result.approved}`);
  console.log(`Rejected: ${result.rejected}`);
  console.log(`Pending: ${result.pending}`);
  console.log(`Approved ruleset: ${result.approvedPath}`);
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
