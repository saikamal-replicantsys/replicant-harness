import { approveRules } from "../workflows/sop-compliance-qc/approve-rules.js";

const idOrPath = process.argv[2];
const approveAll = process.argv.includes("--all");
if (!idOrPath) {
  console.error("Usage: npm run approve-rules -- <ruleset-id-or-json> [-- --all]");
  process.exit(1);
}

approveRules(idOrPath, approveAll).then((result) => {
  console.log("Rule approval complete");
  console.log(`Approved: ${result.approved}`);
  console.log(`Rejected: ${result.rejected}`);
  console.log(`Pending: ${result.pending}`);
  console.log(`Approved ruleset: ${result.approvedPath}`);
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
