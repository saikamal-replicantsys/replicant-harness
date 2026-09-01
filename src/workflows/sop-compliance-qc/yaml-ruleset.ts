import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { NormalizedDocument } from "../../harness/contracts/normalized-document.js";
import type { GroundingEvaluation, RuleSeverity, RuleType, Ruleset, SopRule } from "../../harness/contracts/rule.js";

interface YamlRule {
  id?: string;
  title?: string;
  category?: string;
  severity?: string;
  requirement?: string;
  applies_to?: string[];
  condition?: string;
  expected?: string;
  check_type?: string;
  source?: {
    section?: string;
    quote?: string;
    quote_verified?: boolean;
  };
}

interface YamlRulesDocument {
  name?: string;
  source?: {
    filename?: string;
    title?: string;
  };
  rules?: YamlRule[];
}

export interface NormalizedMetadata {
  fileType?: string;
  sourceFile?: string;
}

const severities = new Set<RuleSeverity>(["critical", "major", "minor", "informational"]);

function asSeverity(value: string | undefined): RuleSeverity {
  return severities.has(value as RuleSeverity) ? value as RuleSeverity : "major";
}

function asRuleType(rule: YamlRule): RuleType {
  if (rule.condition && rule.condition !== "always") return "conditional";
  if (rule.check_type === "format") return "format";
  return "required_content";
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function blocksForRule(sop: NormalizedDocument, ruleId: string, sourceText: string): string[] {
  const headingIndex = sop.blocks.findIndex((block) => block.type === "heading" && block.text === `Rule ${ruleId}`);
  if (headingIndex === -1) {
    const match = sop.blocks.find((block) => sourceText && sourceText.includes(block.text));
    return match ? [match.blockId] : [sop.blocks[0]?.blockId].filter((blockId): blockId is string => Boolean(blockId));
  }

  const blockIds: string[] = [];
  for (const block of sop.blocks.slice(headingIndex, headingIndex + 30)) {
    if (blockIds.length > 0 && block.type === "heading" && /^Rule\s+\S+/.test(block.text)) break;
    blockIds.push(block.blockId);
  }
  return blockIds;
}

function grounding(rule: YamlRule): GroundingEvaluation {
  const verified = rule.source?.quote_verified === true;
  return {
    supported: verified,
    modalityPreserved: true,
    scopePreserved: true,
    unsupportedAdditions: verified ? [] : ["YAML source quote was not marked quote_verified."],
    score: verified ? 1 : 0.8,
    reason: verified ? "Rule imported directly from quote-verified YAML ruleset." : "Rule imported from YAML ruleset but source quote was not marked verified."
  };
}

export async function readNormalizedMetadata(normalizedPath: string): Promise<NormalizedMetadata | undefined> {
  const metadataPath = path.join(path.dirname(normalizedPath), `${path.basename(normalizedPath, path.extname(normalizedPath))}.metadata.json`);
  try {
    return JSON.parse(await fs.readFile(metadataPath, "utf8")) as NormalizedMetadata;
  } catch {
    return undefined;
  }
}

export async function buildYamlRuleset(sourceFile: string, sop: NormalizedDocument, generatedAt = new Date().toISOString()): Promise<Ruleset> {
  const raw = await fs.readFile(sourceFile, "utf8");
  const parsed = YAML.parse(raw) as YamlRulesDocument;
  const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
  const rulesetId = `RULESET-${sop.documentId}`;

  const sopRules: SopRule[] = rules.filter((rule) => text(rule.id)).map((rule): SopRule => {
    const sourceText = text(rule.source?.quote) || text(rule.requirement) || text(rule.expected);
    return {
      ruleId: text(rule.id),
      rulesetId,
      title: text(rule.title) || text(rule.id),
      statement: text(rule.requirement) || text(rule.expected) || text(rule.title),
      description: text(rule.expected) || text(rule.requirement) || text(rule.title),
      ruleType: asRuleType(rule),
      severity: asSeverity(rule.severity),
      applicability: {
        documentTypes: rule.applies_to?.length ? rule.applies_to : ["analytical_method_development_document"],
        conditions: [text(rule.condition) || "always"]
      },
      requirement: {
        type: text(rule.check_type) || "presence",
        value: text(rule.expected) || text(rule.requirement)
      },
      source: {
        documentId: sop.documentId,
        sourceBlockIds: blocksForRule(sop, text(rule.id), sourceText),
        section: text(rule.source?.section) || undefined,
        sourceText
      },
      status: "pending_approval",
      generation: {
        provider: "yaml",
        model: "deterministic-yaml-import",
        generatedAt,
        confidence: rule.source?.quote_verified === true ? 1 : 0.8
      },
      validation: {
        schemaValid: true,
        sourcesValid: true,
        sourceTextValid: true,
        modalityValid: true,
        duplicate: false,
        grounding: grounding(rule),
        requiresReview: rule.source?.quote_verified !== true,
        messages: []
      }
    };
  });

  return {
    rulesetId,
    sopDocumentId: sop.documentId,
    sopFileName: sop.fileName,
    title: `${parsed.name ?? parsed.source?.title ?? sop.title} Ruleset`,
    status: "generated",
    generatedAt,
    rules: sopRules
  };
}
