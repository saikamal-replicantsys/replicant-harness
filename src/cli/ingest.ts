import { ingestClient } from "../client/ingest-client.js";
import type { ClientIngestKind } from "../client/ingest-client.js";
import { inferLeadingClientArg, parseClientArg, resolveClientScope } from "../client/client-scope.js";

function pad(label: string, value: string | number): string {
  return `${label.padEnd(28, ".")} ${value}`;
}

async function main(): Promise<void> {
  const parsed = parseClientArg(process.argv.slice(2));
  const inferred = parsed.clientId ? parsed : inferLeadingClientArg(parsed.rest);
  const clientId = inferred.clientId;
  const rest = [...inferred.rest];
  let kind: ClientIngestKind = "source";
  const kindIndex = rest.indexOf("--kind");
  if (kindIndex !== -1) {
    const value = rest[kindIndex + 1];
    if (value !== "source" && value !== "evidence" && value !== "target") throw new Error("--kind must be source, evidence, or target");
    kind = value;
    rest.splice(kindIndex, 2);
  } else {
    const npmKind = process.env.npm_config_kind;
    if (npmKind === "source" || npmKind === "evidence" || npmKind === "target") {
      kind = npmKind;
      const forwardedIndex = rest.indexOf(npmKind);
      if (forwardedIndex !== -1) rest.splice(forwardedIndex, 1);
    } else if (rest[0] === "source" || rest[0] === "evidence" || rest[0] === "target") {
      kind = rest.shift() as ClientIngestKind;
    }
  }
  if (!clientId || rest.length > 0) throw new Error("Usage: npm run ingest -- --client <client-id> [--kind source|evidence|target]");

  const result = await ingestClient(resolveClientScope(clientId), undefined, { kind });
  console.log(`Client: ${result.clientId}\n`);
  console.log(pad("Kind", kind));
  console.log(pad("Files discovered", result.discovered));
  console.log(pad("DOCX", result.counts.docx ?? 0));
  console.log(pad("DOC", result.counts.doc ?? 0));
  console.log(pad("XLSX", result.counts.xlsx ?? 0));
  console.log(pad("PDF", result.counts.pdf ?? 0));
  console.log(pad("YAML", result.counts.yaml ?? 0));
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
