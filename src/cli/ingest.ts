import { ingestClient } from "../client/ingest-client.js";
import { inferLeadingClientArg, parseClientArg, resolveClientScope } from "../client/client-scope.js";

function pad(label: string, value: string | number): string {
  return `${label.padEnd(28, ".")} ${value}`;
}

async function main(): Promise<void> {
  const parsed = parseClientArg(process.argv.slice(2));
  const inferred = parsed.clientId ? parsed : inferLeadingClientArg(parsed.rest);
  const clientId = inferred.clientId;
  const rest = inferred.rest;
  if (!clientId || rest.length > 0) throw new Error("Usage: npm run ingest -- --client <client-id>");

  const result = await ingestClient(resolveClientScope(clientId));
  console.log(`Client: ${result.clientId}\n`);
  console.log(pad("Files discovered", result.discovered));
  console.log(pad("DOCX", result.counts.docx ?? 0));
  console.log(pad("DOC", result.counts.doc ?? 0));
  console.log(pad("XLSX", result.counts.xlsx ?? 0));
  console.log(pad("Markdown", result.counts.markdown ?? 0));
  console.log("");
  console.log(pad("Converted", result.converted.length));
  console.log(pad("Warnings", result.warnings.length));
  console.log(pad("Failed", result.failed.length));
  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const warning of result.warnings.slice(0, 10)) console.log(`- ${warning}`);
  }
  if (result.failed.length > 0) {
    console.log("\nFailed:");
    for (const failure of result.failed.slice(0, 10)) console.log(`- ${failure.reason}`);
  }
  console.log(`\nOutput:\n${result.outputDir}`);
  if (result.failed.length > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
