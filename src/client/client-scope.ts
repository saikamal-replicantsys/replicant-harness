import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";

export interface ClientScope {
  clientId: string;
  rootDir: string;
  sourceDir: string;
  normalizedDir: string;
  targetDir: string;
  rulesetsDir: string;
  rulesetsGeneratedDir: string;
  rulesetsApprovedDir: string;
  findingsDir: string;
  reportsDir: string;
  tracesDir: string;
  graphPath: string;
}

export function parseClientArg(args: string[]): { clientId?: string; rest: string[] } {
  const rest = [...args];
  const index = rest.indexOf("--client");
  if (index === -1) {
    const npmClient = process.env.npm_config_client;
    if (npmClient === "true" || npmClient === "false") return { rest };
    if (!npmClient) return { rest };
    const npmForwardedValueIndex = rest.indexOf(npmClient);
    if (npmForwardedValueIndex !== -1) rest.splice(npmForwardedValueIndex, 1);
    return { clientId: npmClient, rest };
  }
  const clientId = rest[index + 1];
  if (!clientId) throw new Error("Missing value for --client");
  rest.splice(index, 2);
  return { clientId, rest };
}

export function inferLeadingClientArg(args: string[], dataRoot = "data/clients"): { clientId?: string; rest: string[] } {
  const [candidate, ...rest] = args;
  if (!candidate) return { rest: args };
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(candidate)) return { rest: args };
  if (!fsSync.existsSync(path.join(dataRoot, candidate))) return { rest: args };
  return { clientId: candidate, rest };
}

export function assertSafeClientId(clientId: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(clientId)) {
    throw new Error(`Invalid client id "${clientId}". Use letters, numbers, and hyphens only.`);
  }
}

export function resolveClientScope(clientId: string, dataRoot = "data/clients"): ClientScope {
  assertSafeClientId(clientId);
  const rootDir = path.join(dataRoot, clientId);
  return {
    clientId,
    rootDir,
    sourceDir: path.join(rootDir, "source"),
    normalizedDir: path.join(rootDir, "normalized"),
    targetDir: path.join(rootDir, "target"),
    rulesetsDir: path.join(rootDir, "rulesets"),
    rulesetsGeneratedDir: path.join(rootDir, "rulesets", "generated"),
    rulesetsApprovedDir: path.join(rootDir, "rulesets", "approved"),
    findingsDir: path.join(rootDir, "findings"),
    reportsDir: path.join(rootDir, "reports"),
    tracesDir: path.join(rootDir, "traces"),
    graphPath: path.join(rootDir, "graph.json")
  };
}

export async function ensureClientScope(scope: ClientScope): Promise<void> {
  await Promise.all([
    fs.mkdir(scope.sourceDir, { recursive: true }),
    fs.mkdir(scope.normalizedDir, { recursive: true }),
    fs.mkdir(scope.targetDir, { recursive: true }),
    fs.mkdir(scope.rulesetsGeneratedDir, { recursive: true }),
    fs.mkdir(scope.rulesetsApprovedDir, { recursive: true }),
    fs.mkdir(scope.findingsDir, { recursive: true }),
    fs.mkdir(scope.reportsDir, { recursive: true }),
    fs.mkdir(scope.tracesDir, { recursive: true })
  ]);
}

export function assertPathInside(childPath: string, parentPath: string): void {
  const relative = path.relative(path.resolve(parentPath), path.resolve(childPath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes client scope: ${childPath}`);
  }
}
