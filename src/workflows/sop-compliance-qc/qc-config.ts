import fs from "node:fs/promises";
import YAML from "yaml";

export interface SopQcRuntimeConfig {
  maxRulesPerQcRequest: number;
  maxTargetBlocksPerQcRequest: number;
  maxEvidenceBlocksPerDocumentPerQcRequest: number;
  maxCharsPerContextDocument: number;
}

const defaults: SopQcRuntimeConfig = {
  maxRulesPerQcRequest: 10,
  maxTargetBlocksPerQcRequest: 120,
  maxEvidenceBlocksPerDocumentPerQcRequest: 80,
  maxCharsPerContextDocument: 30000
};

export async function loadSopQcRuntimeConfig(configPath = "harness.config.yaml"): Promise<SopQcRuntimeConfig> {
  try {
    const parsed = YAML.parse(await fs.readFile(configPath, "utf8")) as {
      workflows?: {
        sopComplianceQc?: {
          limits?: {
            maxRulesPerQcRequest?: number;
            maxTargetBlocksPerQcRequest?: number;
            maxEvidenceBlocksPerDocumentPerQcRequest?: number;
            maxCharsPerContextDocument?: number;
          };
        };
      };
    };
    const limits = parsed.workflows?.sopComplianceQc?.limits;
    const positive = (value: unknown, fallback: number) => typeof value === "number" && value > 0 ? value : fallback;
    return {
      maxRulesPerQcRequest: positive(limits?.maxRulesPerQcRequest, defaults.maxRulesPerQcRequest),
      maxTargetBlocksPerQcRequest: positive(limits?.maxTargetBlocksPerQcRequest, defaults.maxTargetBlocksPerQcRequest),
      maxEvidenceBlocksPerDocumentPerQcRequest: positive(limits?.maxEvidenceBlocksPerDocumentPerQcRequest, defaults.maxEvidenceBlocksPerDocumentPerQcRequest),
      maxCharsPerContextDocument: positive(limits?.maxCharsPerContextDocument, defaults.maxCharsPerContextDocument)
    };
  } catch {
    return defaults;
  }
}
