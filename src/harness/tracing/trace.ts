import fs from "node:fs/promises";
import path from "node:path";

export interface HarnessTrace {
  runId: string;
  workflow: string;
  provider: string;
  model: string;
  startedAt: string;
  completedAt: string;
  guideVersions: Record<string, string>;
  sensors: unknown[];
  finalDecision: string;
  [key: string]: unknown;
}

export async function writeTrace(trace: HarnessTrace): Promise<string> {
  await fs.mkdir("data/traces", { recursive: true });
  const filePath = path.join("data/traces", `${trace.runId}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(trace, null, 2)}\n`, "utf8");
  return filePath;
}
