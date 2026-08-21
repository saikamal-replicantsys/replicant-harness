import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const scenarioPath = path.join(root, "scenarios", "02-missing-citations", "expected-result.json");
const requestPath = path.join(root, "scenarios", "02-missing-citations", "request.json");

function mark(status) {
  if (status === "passed") return "PASS";
  if (status === "failed") return "FAIL";
  if (status === "warning") return "WARN";
  return status.toUpperCase();
}

function pad(label) {
  return `${label} ${".".repeat(Math.max(1, 24 - label.length))}`;
}

const [scenario, request] = await Promise.all([
  readFile(scenarioPath, "utf8").then(JSON.parse),
  readFile(requestPath, "utf8").then(JSON.parse)
]);

console.log("");
console.log("RepliSense Harness Demo");
console.log("=======================");
console.log("");
console.log(`Workflow: ${request.workflowId}`);
console.log(`Run:      ${request.runId}`);
console.log(`Section:  ${request.section.sectionId}`);
console.log(`Evidence: ${request.evidence_chunks.map((chunk) => chunk.chunkId).join(", ")}`);
console.log("");

for (const step of scenario.expectedLifecycle) {
  console.log(`Attempt ${step.attempt}`);
  for (const result of step.expectedSensorResults ?? []) {
    console.log(`${pad(result.sensor)} ${mark(result.status)}`);
  }
  console.log(`${pad("action")} ${step.expectedDecision}`);
  console.log("");
}

console.log(`Final Decision: ${scenario.expectedFinalDecision}`);
console.log("");
console.log("Key point: the first response is schema-valid, but citation-invalid.");
console.log("The harness regenerates with evidence before accepting the section.");
console.log("");
