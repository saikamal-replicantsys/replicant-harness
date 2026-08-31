import { GraphStore } from "../../knowledge/graph.store.js";
import type { QcFinding } from "../../harness/contracts/finding.js";

export async function buildFindingProvenance(findings: QcFinding[], graph = new GraphStore()): Promise<void> {
  await graph.addFindings(findings);
}
