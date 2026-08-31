import { GraphStore } from "../../knowledge/graph.store.js";
import type { QcFinding } from "../../harness/contracts/finding.js";

export async function buildFindingProvenance(findings: QcFinding[]): Promise<void> {
  await new GraphStore().addFindings(findings);
}
