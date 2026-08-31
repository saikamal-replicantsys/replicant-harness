import fs from "node:fs/promises";
import path from "node:path";
import { assertPathInside } from "../../client/client-scope.js";
import type { ClientScope } from "../../client/client-scope.js";
import type { Ruleset, SopRule } from "../../harness/contracts/rule.js";

export async function writeJson(filePath: string, value: unknown): Promise<string> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return filePath;
}

export async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

export async function findGeneratedRuleset(idOrPath: string, scope?: ClientScope): Promise<string> {
  if (idOrPath.endsWith(".json")) {
    if (scope) assertPathInside(idOrPath, scope.rulesetsGeneratedDir);
    return idOrPath;
  }
  return path.join(scope?.rulesetsGeneratedDir ?? "data/rulesets/generated", `${idOrPath}.json`);
}

export async function loadApprovedRules(scope?: ClientScope): Promise<SopRule[]> {
  const dir = scope?.rulesetsApprovedDir ?? "data/rulesets/approved";
  const entries = await fs.readdir(dir).catch(() => []);
  const rulesets = await Promise.all(entries.filter((entry) => entry.endsWith(".json")).map((entry) => readJson<Ruleset>(path.join(dir, entry))));
  return rulesets.flatMap((ruleset) => ruleset.rules).filter((rule) => rule.status === "approved");
}
