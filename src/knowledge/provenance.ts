import { GraphStore } from "./graph.store.js";

export async function getLineageForFinding(findingId: string) {
  return new GraphStore().getLineageForFinding(findingId);
}

export async function getLineageForRule(ruleId: string) {
  return new GraphStore().getLineageForRule(ruleId);
}
