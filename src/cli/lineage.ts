import { GraphStore } from "../knowledge/graph.store.js";

const id = process.argv[2];
if (!id) {
  console.error("Usage: npm run lineage -- <finding-id-or-rule-id>");
  process.exit(1);
}

const graph = new GraphStore();
const lineage = id.startsWith("QC-")
  ? await graph.getLineageForFinding(id)
  : await graph.getLineageForRule(id);

console.log(JSON.stringify(lineage, null, 2));
