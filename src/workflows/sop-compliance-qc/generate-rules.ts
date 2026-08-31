import fs from "node:fs/promises";
import path from "node:path";
import { assertPathInside } from "../../client/client-scope.js";
import type { ClientScope } from "../../client/client-scope.js";
import type { AIProvider } from "../../providers/provider.js";
import { MarkdownDocumentAdapter } from "../../documents/markdown.adapter.js";
import type { Ruleset } from "../../harness/contracts/rule.js";
import { validateRuleset } from "../../harness/sensors/rule-sensors.js";
import { GraphStore } from "../../knowledge/graph.store.js";
import { writeTrace } from "../../harness/tracing/trace.js";
import { writeJson } from "./store.js";
import { evaluateRuleGrounding } from "./evaluators.js";
import type { RuleCandidateResponse, RuleGenerationResult } from "./workflow.types.js";
import { ruleCandidatesSchema } from "../../providers/structured-schemas.js";

export async function generateRules(sopPath: string, provider: AIProvider, scope?: ClientScope): Promise<RuleGenerationResult> {
  if (scope) assertPathInside(sopPath, scope.normalizedDir);
  const startedAt = new Date().toISOString();
  const adapter = new MarkdownDocumentAdapter();
  const sop = await adapter.parse(sopPath, { documentType: "sop", clientId: scope?.clientId, normalizedFile: sopPath });
  const normalizedPath = path.join(scope?.normalizedDir ?? "data/normalized/sop", `${sop.documentId}.json`);
  await writeJson(normalizedPath, sop);

  const guide = await fs.readFile("guides/sop-rule-generation.md", "utf8");
  const runId = `RULE-GEN-${Date.now()}`;
  const response = await provider.generateStructured<RuleCandidateResponse>({
    runId,
    guideId: "sop-rule-generation",
    guideVersion: "1.0.0",
    schemaName: "sop-rule-candidates",
    schema: ruleCandidatesSchema,
    system: guide,
    prompt: JSON.stringify({ sopDocument: sop, instruction: "Generate candidate SOP rules with sourceBlockIds." })
  });

  const ruleset: Ruleset = {
    rulesetId: `RULESET-${sop.documentId}`,
    sopDocumentId: sop.documentId,
    sopFileName: sop.fileName,
    title: `${sop.title} Ruleset`,
    status: "generated",
    generatedAt: new Date().toISOString(),
    rules: response.parsed.rules.map((rule) => ({
      ...rule,
      rulesetId: `RULESET-${sop.documentId}`,
      status: "pending_approval",
      generation: { ...rule.generation, provider: response.provider, model: response.model, generatedAt: new Date().toISOString() }
    }))
  };

  for (const rule of ruleset.rules) {
    const sourceBlockIds = Array.isArray(rule.source?.sourceBlockIds) ? rule.source.sourceBlockIds : [];
    const evidence = sop.blocks.filter((block) => sourceBlockIds.includes(block.blockId));
    rule.validation = { ...(rule.validation ?? { schemaValid: false, sourcesValid: false, sourceTextValid: false, modalityValid: false, duplicate: false, messages: [] }), grounding: await evaluateRuleGrounding(provider, rule, evidence) };
  }

  const validation = validateRuleset(ruleset, sop);
  const generatedPath = await writeJson(path.join(scope?.rulesetsGeneratedDir ?? "data/rulesets/generated", `${ruleset.rulesetId}.json`), ruleset);
  const graph = new GraphStore(scope?.graphPath);
  await graph.addDocument(sop);
  await graph.addRuleset(ruleset);
  const tracePath = await writeTrace({
    runId,
    workflow: "sop.rule_generation",
    provider: response.provider,
    model: response.model,
    startedAt,
    completedAt: new Date().toISOString(),
    documentId: sop.documentId,
    guideVersions: { "sop-rule-generation": "1.0.0" },
    attempts: [{ attempt: 1, latencyMs: response.latencyMs, tokenUsage: response.tokenUsage }],
    sensors: validation.sensors,
    rules: { generated: validation.generated, valid: validation.valid, requiresReview: validation.requiresReview },
    finalDecision: "AWAITING_HUMAN_APPROVAL"
  }, scope?.tracesDir);
  return { ruleset, generatedPath, tracePath };
}
