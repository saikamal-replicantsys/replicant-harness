import { GraphStore } from "../knowledge/graph.store.js";
import { inferLeadingClientArg, parseClientArg, resolveClientScope } from "../client/client-scope.js";

const parsed = parseClientArg(process.argv.slice(2));
const inferred = parsed.clientId ? parsed : inferLeadingClientArg(parsed.rest);
const clientId = inferred.clientId;
const rest = inferred.rest;
const id = rest[0];
if (!id) {
  console.error("Usage: npm run lineage -- [--client <client-id>] <finding-id-or-rule-id>");
  process.exit(1);
}

const graph = new GraphStore(clientId ? resolveClientScope(clientId).graphPath : undefined);
const lineage = id.startsWith("QC-")
  ? await graph.getLineageForFinding(id)
  : await graph.getLineageForRule(id);

console.log(JSON.stringify(lineage, null, 2));
