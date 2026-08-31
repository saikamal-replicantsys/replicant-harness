export type GraphNodeType = "SOP_DOCUMENT" | "TARGET_DOCUMENT" | "SECTION" | "EVIDENCE_BLOCK" | "RULESET" | "RULE" | "FINDING" | "RUN";
export type GraphEdgeType = "CONTAINS" | "HAS_SECTION" | "SUPPORTS_RULE" | "BELONGS_TO_RULESET" | "APPROVED_AS" | "APPLIES_TO" | "VIOLATED_BY" | "FOUND_IN" | "GENERATED_DURING";

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  from: string;
  type: GraphEdgeType;
  to: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
