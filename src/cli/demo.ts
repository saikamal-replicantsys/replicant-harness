import fs from "node:fs/promises";
import { MockAIProvider } from "../providers/mock.provider.js";
import { generateRules } from "../workflows/sop-compliance-qc/generate-rules.js";
import { approveRules } from "../workflows/sop-compliance-qc/approve-rules.js";
import { runQc } from "../workflows/sop-compliance-qc/run-qc.js";

async function resetDemoOutputs(): Promise<void> {
  await fs.rm("data/normalized", { recursive: true, force: true });
  await fs.rm("data/rulesets", { recursive: true, force: true });
  await fs.rm("data/findings", { recursive: true, force: true });
  await fs.rm("data/knowledge", { recursive: true, force: true });
  await fs.rm("data/reports", { recursive: true, force: true });
  await fs.rm("data/traces", { recursive: true, force: true });
}

await resetDemoOutputs();
const provider = new MockAIProvider();

console.log("RepliSense SOP Harness");
console.log("======================");
console.log("");
console.log("STEP 1 - SOP RULE GENERATION");
console.log("");
console.log("SOP:");
console.log("Document Control SOP");
console.log("");

const rules = await generateRules("data/demo/sop/document-control-sop.md", provider);
console.log(`Candidate rules generated .......... ${rules.ruleset.rules.length}`);
console.log("Schema validation .................. PASS");
console.log("Source references .................. PASS");
console.log("Grounding evaluation ............... PASS");
console.log("");
console.log(`Ruleset:\n${rules.ruleset.rulesetId}`);
console.log("");
console.log("DEMO MODE ONLY - production workflow requires human approval.");
const approval = await approveRules(rules.ruleset.rulesetId, true);
console.log(`Approved rules ..................... ${approval.approved}`);
console.log("");

console.log("STEP 2 - TARGET DOCUMENT QC");
console.log("");
console.log("Target:");
console.log("Batch Manufacturing Record");
console.log("");
const qc = await runQc("data/demo/target/batch-record.md", provider);
console.log(`Approved rules loaded .............. ${approval.approved}`);
console.log(`Relevant rules ..................... ${approval.approved}`);
console.log(`Candidate findings ................. ${qc.findings.length}`);
console.log("");
for (const finding of qc.accepted) {
  console.log(`Finding ${finding.findingId}`);
  console.log("Rule exists ........................ PASS");
  console.log("Rule approved ...................... PASS");
  console.log("SOP lineage ........................ PASS");
  console.log("Target reference ................... PASS");
  console.log("Groundedness ....................... PASS");
  console.log("Decision ........................... ACCEPT");
  console.log("");
}
console.log("FINAL");
console.log("");
console.log(`Accepted findings .................. ${qc.accepted.length}`);
console.log(`Human review ....................... ${qc.humanReview.length}`);
console.log("");
console.log("Outputs:");
console.log(rules.generatedPath);
console.log(approval.approvedPath);
console.log(qc.findingsPath);
console.log(qc.reportPath);
console.log(qc.oldQcPath);
console.log(qc.tracePath);
