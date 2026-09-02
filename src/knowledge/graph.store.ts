import fs from "node:fs/promises";
import path from "node:path";
import type { QcFinding } from "../harness/contracts/finding.js";
import type { NormalizedDocument } from "../harness/contracts/normalized-document.js";
import type { Ruleset, SopRule } from "../harness/contracts/rule.js";
import type { GraphEdge, GraphNode, KnowledgeGraph } from "./graph.types.js";

const graphPath = "data/knowledge/graph.json";

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const item of items) byKey.set(keyFn(item), item);
  return Array.from(byKey.values());
}

export class GraphStore {
  constructor(private readonly filePath = graphPath) {}

  async load(): Promise<KnowledgeGraph> {
    try {
      return JSON.parse(await fs.readFile(this.filePath, "utf8")) as KnowledgeGraph;
    } catch {
      return { nodes: [], edges: [] };
    }
  }

  async save(graph: KnowledgeGraph): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    graph.nodes = uniqueBy(graph.nodes, (node) => `${node.type}:${node.id}`);
    graph.edges = uniqueBy(graph.edges, (edge) => `${edge.from}:${edge.type}:${edge.to}`);
    await fs.writeFile(this.filePath, `${JSON.stringify(graph, null, 2)}\n`, "utf8");
  }

  async addNodesAndEdges(nodes: GraphNode[], edges: GraphEdge[]): Promise<void> {
    const graph = await this.load();
    graph.nodes.push(...nodes);
    graph.edges.push(...edges);
    await this.save(graph);
  }

  async addDocument(document: NormalizedDocument): Promise<void> {
    const type = document.documentType === "sop" ? "SOP_DOCUMENT" : document.documentType === "evidence" ? "SOURCE_DOCUMENT" : "TARGET_DOCUMENT";
    const nodes: GraphNode[] = [{ id: document.documentId, type, properties: { name: document.title, fileName: document.fileName, sourceFile: document.sourceFile } }];
    const edges: GraphEdge[] = [];
    for (const block of document.blocks) {
      nodes.push({ id: block.blockId, type: "EVIDENCE_BLOCK", properties: { text: block.text, section: block.location.section, sheet: block.location.sheet, cellRange: block.location.cellRange, blockType: block.type } });
      edges.push({ from: document.documentId, type: "CONTAINS", to: block.blockId });
    }
    await this.addNodesAndEdges(nodes, edges);
  }

  async addRuleset(ruleset: Ruleset): Promise<void> {
    const nodes: GraphNode[] = [{ id: ruleset.rulesetId, type: "RULESET", properties: { status: ruleset.status, sopDocumentId: ruleset.sopDocumentId, title: ruleset.title } }];
    const edges: GraphEdge[] = [{ from: ruleset.sopDocumentId, type: "GENERATED_DURING", to: ruleset.rulesetId }];
    for (const rule of ruleset.rules) {
      nodes.push({ id: rule.ruleId, type: "RULE", properties: { status: rule.status, title: rule.title, severity: rule.severity } });
      edges.push({ from: rule.ruleId, type: "BELONGS_TO_RULESET", to: ruleset.rulesetId });
      for (const blockId of rule.source.sourceBlockIds) edges.push({ from: blockId, type: "SUPPORTS_RULE", to: rule.ruleId });
      if (rule.status === "approved") edges.push({ from: rule.ruleId, type: "APPROVED_AS", to: `${rule.ruleId}:approved` });
    }
    await this.addNodesAndEdges(nodes, edges);
  }

  async addFindings(findings: QcFinding[]): Promise<void> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    for (const finding of findings) {
      nodes.push({ id: finding.findingId, type: "FINDING", properties: { decision: finding.decision, title: finding.title, severity: finding.severity } });
      edges.push({ from: finding.rule.ruleId, type: "VIOLATED_BY", to: finding.findingId });
      for (const blockId of finding.target.blockIds) edges.push({ from: finding.findingId, type: "FOUND_IN", to: blockId });
      for (const source of finding.evidenceSources ?? []) {
        for (const blockId of source.blockIds) edges.push({ from: finding.findingId, type: "SUPPORTED_BY_SOURCE", to: blockId });
      }
    }
    await this.addNodesAndEdges(nodes, edges);
  }

  async getRule(ruleId: string): Promise<GraphNode | undefined> {
    return (await this.load()).nodes.find((node) => node.type === "RULE" && node.id === ruleId);
  }

  async getRuleset(rulesetId: string): Promise<GraphNode | undefined> {
    return (await this.load()).nodes.find((node) => node.type === "RULESET" && node.id === rulesetId);
  }

  async getApprovedRules(): Promise<GraphNode[]> {
    return (await this.load()).nodes.filter((node) => node.type === "RULE" && node.properties.status === "approved");
  }

  async getEvidenceForRule(ruleId: string): Promise<GraphNode[]> {
    const graph = await this.load();
    const evidenceIds = graph.edges.filter((edge) => edge.type === "SUPPORTS_RULE" && edge.to === ruleId).map((edge) => edge.from);
    return graph.nodes.filter((node) => evidenceIds.includes(node.id));
  }

  async getLineageForRule(ruleId: string) {
    const graph = await this.load();
    const rule = graph.nodes.find((node) => node.id === ruleId && node.type === "RULE");
    const rulesetId = graph.edges.find((edge) => edge.from === ruleId && edge.type === "BELONGS_TO_RULESET")?.to;
    const ruleset = graph.nodes.find((node) => node.id === rulesetId);
    const sopId = ruleset?.properties.sopDocumentId as string | undefined;
    const sop = graph.nodes.find((node) => node.id === sopId);
    const sopEvidence = await this.getEvidenceForRule(ruleId);
    return { rule, ruleset, sop, sopEvidence };
  }

  async getLineageForFinding(findingId: string) {
    const graph = await this.load();
    const finding = graph.nodes.find((node) => node.id === findingId && node.type === "FINDING");
    const ruleId = graph.edges.find((edge) => edge.type === "VIOLATED_BY" && edge.to === findingId)?.from;
    const ruleLineage = ruleId ? await this.getLineageForRule(ruleId) : undefined;
    const targetBlockIds = graph.edges.filter((edge) => edge.from === findingId && edge.type === "FOUND_IN").map((edge) => edge.to);
    const targetBlocks = graph.nodes.filter((node) => targetBlockIds.includes(node.id));
    const sourceBlockIds = graph.edges.filter((edge) => edge.from === findingId && edge.type === "SUPPORTED_BY_SOURCE").map((edge) => edge.to);
    const sourceBlocks = graph.nodes.filter((node) => sourceBlockIds.includes(node.id));
    const targetDocEdge = graph.edges.find((edge) => targetBlockIds.includes(edge.to) && edge.type === "CONTAINS");
    const target = graph.nodes.find((node) => node.id === targetDocEdge?.from);
    const sourceDocumentIds = graph.edges.filter((edge) => sourceBlockIds.includes(edge.to) && edge.type === "CONTAINS").map((edge) => edge.from);
    const sourceDocuments = graph.nodes.filter((node) => sourceDocumentIds.includes(node.id));
    return { finding, ...ruleLineage, target, targetBlocks, sourceDocuments, sourceBlocks };
  }
}
