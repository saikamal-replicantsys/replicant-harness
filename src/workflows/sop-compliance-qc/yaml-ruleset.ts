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
  system?: string;
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
  const headingIndex = sop.blocks.findIndex((block) => block.type === "heading" && (block.text === `Rule ${ruleId}` || block.text.startsWith(`Rule ${ruleId}:`) || block.text.startsWith(`Rule QC-${ruleId.replace(/^QC-/, "")}:`)));
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

function ruleFromPrompt(params: {
  ruleId: string;
  title: string;
  statement: string;
  description?: string;
  severity: RuleSeverity;
  section?: string;
  category?: string;
  sourceText?: string;
}): YamlRule {
  return {
    id: params.ruleId,
    title: params.title,
    category: params.category,
    severity: params.severity,
    requirement: params.statement,
    expected: params.description ?? params.statement,
    check_type: params.category ?? "presence",
    source: {
      section: params.section,
      quote: params.sourceText ?? params.statement,
      quote_verified: true
    }
  };
}

function severityFromBracket(textValue: string): RuleSeverity {
  const sourceSeverity = textValue.match(/source severity=([a-z]+)/i)?.[1]?.toLowerCase();
  if (sourceSeverity) return asSeverity(sourceSeverity);
  const outputSeverity = textValue.match(/\b(high|medium|low)\b/i)?.[1]?.toLowerCase();
  if (outputSeverity === "high") return "critical";
  if (outputSeverity === "medium") return "major";
  if (outputSeverity === "low") return "minor";
  return "major";
}

function extractLineValue(block: string, label: string): string {
  const match = block.match(new RegExp(`^\\s*${label}:\\s*(.+)$`, "im"));
  return text(match?.[1]);
}

function promptRules(systemText: string): YamlRule[] {
  const normalized = systemText.replace(/\r\n?/g, "\n");
  const rules: YamlRule[] = [];

  for (const match of normalized.matchAll(/^RULE\s+([A-Z]\d*)\s+[-—]\s+(.+)$/gm)) {
    const start = match.index ?? 0;
    const next = normalized.slice(start + match[0].length).search(/\nRULE\s+[A-Z]\d*\s+[-—]|\n[=─-]{8,}/);
    const body = next === -1 ? normalized.slice(start) : normalized.slice(start, start + match[0].length + next);
    const ruleId = `QC-${match[1]}`;
    rules.push(ruleFromPrompt({
      ruleId,
      title: text(match[2]),
      statement: body.replace(match[0], "").trim(),
      severity: /severity\s+"?high/i.test(body) ? "critical" : /severity\s+"?low/i.test(body) ? "minor" : "major",
      section: "Baseline QC Rules",
      category: /tense/i.test(body) ? "grammar" : /spelling|english/i.test(body) ? "spelling" : /title case|format/i.test(body) ? "format" : "qc",
      sourceText: body.trim()
    }));
  }

  const sopRulesStart = normalized.search(/\nSOP RULES\s*\n/i);
  if (sopRulesStart !== -1) {
    const sopText = normalized.slice(sopRulesStart);
    const sopMatches = Array.from(sopText.matchAll(/^- ([A-Z]+-\d+)\s+\[([^\]]+)\]\s+(.+?)(?=\n- [A-Z]+-\d+\s+\[|\s*$)/gms));
    for (const match of sopMatches) {
      const ruleId = text(match[1]);
      const bracket = text(match[2]);
      const body = text(match[3]);
      const titleLine = body.split("\n")[0]?.trim() ?? ruleId;
      const requirement = extractLineValue(body, "Requirement") || titleLine;
      const appliesTo = extractLineValue(body, "Applies to");
      const condition = extractLineValue(body, "Condition") || "always";
      const expected = extractLineValue(body, "Expected evidence") || requirement;
      const category = bracket.match(/category=([a-z0-9_-]+)/i)?.[1];
      rules.push({
        id: ruleId,
        title: titleLine,
        category,
        severity: severityFromBracket(bracket),
        requirement,
        applies_to: appliesTo ? appliesTo.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
        condition,
        expected,
        check_type: category ?? "presence",
        source: {
          section: "SOP RULES",
          quote: body,
          quote_verified: true
        }
      });
    }
  }

  if (/DETECT ALL ERROR TYPES/i.test(normalized)) {
    rules.push(ruleFromPrompt({
      ruleId: "QC-ERROR-TYPES",
      title: "Detect scientific, numeric, writing, formatting, structural, and consistency errors",
      statement: "Detect scientific incorrectness, numeric mismatch, process errors, specification violations, data integrity issues, grammar, spelling, formatting, structural issues, reference errors, missing information, and inconsistencies.",
      severity: "major",
      section: "Detect All Error Types",
      category: "qc",
      sourceText: "Scientific-Incorrect; Numeric-Mismatch; Process-Error; Spec-Violation; Data-Integrity; Grammar; Spelling; Formatting; Structural; Reference-Error; Missing-Info; Inconsistency."
    }));
  }

  return rules;
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
  const rules = Array.isArray(parsed.rules) ? parsed.rules : typeof parsed.system === "string" ? promptRules(parsed.system) : [];
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
