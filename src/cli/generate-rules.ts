import { createProvider } from "../providers/provider-factory.js";
import { generateRules } from "../workflows/sop-compliance-qc/generate-rules.js";

async function main(): Promise<void> {
  const sopPath = process.argv[2];
  if (!sopPath) throw new Error("Usage: npm run rules -- <path-to-sop.md>");
  const result = await generateRules(sopPath, createProvider());
  console.log("Rule generation complete");
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
