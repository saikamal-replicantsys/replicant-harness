import fs from "node:fs/promises";
import YAML from "yaml";

export interface SopQcRuntimeConfig {
  maxRulesPerQcRequest: number;
}

export async function loadSopQcRuntimeConfig(configPath = "harness.config.yaml"): Promise<SopQcRuntimeConfig> {
  try {
    const parsed = YAML.parse(await fs.readFile(configPath, "utf8")) as {
      workflows?: {
        sopComplianceQc?: {
          limits?: {
            maxRulesPerQcRequest?: number;
          };
        };
      };
    };
    const configured = parsed.workflows?.sopComplianceQc?.limits?.maxRulesPerQcRequest;
    return {
      maxRulesPerQcRequest: typeof configured === "number" && configured > 0 ? configured : 25
    };
  } catch {
    return { maxRulesPerQcRequest: 25 };
  }
}
