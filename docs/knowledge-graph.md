# Knowledge Graph

The POC uses a lightweight filesystem JSON graph at `data/knowledge/graph.json`.

## Why A Graph

SOP compliance findings need lineage. For every accepted finding, the harness must resolve:

```text
Finding -> Rule -> Ruleset -> SOP Document -> SOP Evidence Block
Finding -> Target Document -> Target Evidence Block
```

## What It Stores

Nodes:

- `SOP_DOCUMENT`
- `TARGET_DOCUMENT`
- `SECTION`
- `EVIDENCE_BLOCK`
- `RULESET`
- `RULE`
- `FINDING`
- `RUN`

Edges:

- `CONTAINS`
- `HAS_SECTION`
- `SUPPORTS_RULE`
- `BELONGS_TO_RULESET`
- `APPROVED_AS`
- `APPLIES_TO`
- `VIOLATED_BY`
- `FOUND_IN`
- `GENERATED_DURING`

## What It Does Not Do

The Knowledge Graph is not the semantic reasoning engine.

It handles identity, hierarchy, relationships, provenance, approval state, and lineage. Gemini handles semantic candidate generation and semantic evaluation. Later, vector retrieval can be introduced between graph filtering and Gemini.

## Why JSON Is Sufficient

For a local POC, JSON keeps the graph inspectable and demo-friendly. There is no database, server, migration layer, or infrastructure dependency.

## Migration Path

If the feature graduates, the same node and edge concepts can move into application persistence, a relational model, or a graph store if query complexity justifies it.
