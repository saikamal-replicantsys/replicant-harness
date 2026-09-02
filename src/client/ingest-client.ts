import fs from "node:fs/promises";
import path from "node:path";
import type { ClientScope } from "./client-scope.js";
import { assertPathInside, ensureClientScope } from "./client-scope.js";
import { defaultDocumentAdapters } from "../documents/adapters.js";
import type { DocumentAdapter } from "../documents/document-adapter.js";
import { normalizedToMarkdown } from "../documents/markdown-writer.js";
import type { NormalizedDocument } from "../documents/normalized-document.js";

export interface IngestedFile {
  sourceFile: string;
  normalizedFile: string;
  metadataFile: string;
  fileType: string;
  blocks: number;
}

export interface IngestFailure {
  sourceFile: string;
  reason: string;
}

export interface ClientIngestResult {
  clientId: string;
  discovered: number;
  counts: Record<string, number>;
  converted: IngestedFile[];
  warnings: string[];
  failed: IngestFailure[];
  outputDir: string;
}

export type ClientIngestKind = "source" | "evidence" | "target";

export interface ClientIngestOptions {
  kind?: ClientIngestKind;
}

const knownExtensions = new Set([".md", ".docx", ".xlsx", ".yaml", ".yml", ".doc", ".pdf"]);

function findAdapter(filePath: string, adapters: DocumentAdapter[]): DocumentAdapter | undefined {
  return adapters.find((adapter) => adapter.supports(filePath));
}

function directoryForKind(scope: ClientScope, kind: ClientIngestKind): { inputDir: string; outputDir: string; documentType: "sop" | "target" | "evidence" } {
  if (kind === "target") return { inputDir: scope.targetDir, outputDir: path.join(scope.normalizedDir, "target"), documentType: "target" };
  if (kind === "evidence") return { inputDir: scope.evidenceDir, outputDir: path.join(scope.normalizedDir, "evidence"), documentType: "evidence" };
  return { inputDir: scope.sourceDir, outputDir: scope.normalizedDir, documentType: "sop" };
}

function outputPaths(outputDir: string, sourceFile: string): { markdownPath: string; metadataPath: string } {
  const baseName = path.basename(sourceFile, path.extname(sourceFile));
  const markdownPath = path.join(outputDir, `${baseName}.md`);
  const metadataPath = path.join(outputDir, `${baseName}.metadata.json`);
  assertPathInside(markdownPath, outputDir);
  assertPathInside(metadataPath, outputDir);
  return { markdownPath, metadataPath };
}

function metadataFor(document: NormalizedDocument): Record<string, unknown> {
  return {
    documentId: document.documentId,
    clientId: document.clientId,
    sourceFile: document.sourceFile,
    fileType: document.fileType,
    normalizedFile: document.normalizedFile,
    title: document.title,
    blocks: document.blocks.map((block) => ({
      blockId: block.blockId,
      type: block.type,
      location: block.location
    }))
  };
}

export async function normalizeSourceFile(params: {
  filePath: string;
  outputDir: string;
  documentType: "sop" | "target" | "evidence";
  clientId: string;
  adapters?: DocumentAdapter[];
}): Promise<IngestedFile> {
  const adapters = params.adapters ?? defaultDocumentAdapters();
  const adapter = findAdapter(params.filePath, adapters);
  if (!adapter) throw new Error(`No adapter found for ${path.extname(params.filePath).toLowerCase()}`);
  await fs.mkdir(params.outputDir, { recursive: true });
  const { markdownPath, metadataPath } = outputPaths(params.outputDir, params.filePath);
  const document = await adapter.parse(params.filePath, {
    documentType: params.documentType,
    clientId: params.clientId,
    normalizedFile: markdownPath
  });
  document.sourceFile = params.filePath;
  document.normalizedFile = markdownPath;
  await fs.writeFile(markdownPath, normalizedToMarkdown(document), "utf8");
  await fs.writeFile(metadataPath, `${JSON.stringify(metadataFor(document), null, 2)}\n`, "utf8");
  return {
    sourceFile: params.filePath,
    normalizedFile: markdownPath,
    metadataFile: metadataPath,
    fileType: document.fileType,
    blocks: document.blocks.length
  };
}

export async function ingestClient(scope: ClientScope, adapters = defaultDocumentAdapters(), options: ClientIngestOptions = {}): Promise<ClientIngestResult> {
  await ensureClientScope(scope);
  const kind = options.kind ?? "source";
  const dirs = directoryForKind(scope, kind);
  const entries = await fs.readdir(dirs.inputDir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(dirs.inputDir, entry.name));
  const counts: Record<string, number> = { docx: 0, doc: 0, xlsx: 0, yaml: 0, markdown: 0, pdf: 0, unsupported: 0 };
  const converted: IngestedFile[] = [];
  const warnings: string[] = [];
  const failed: IngestFailure[] = [];

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    const label = ext === ".md" ? "markdown" : ext === ".yml" ? "yaml" : ext.replace(".", "");
    counts[label] = (counts[label] ?? 0) + 1;
    if (!knownExtensions.has(ext)) {
      counts.unsupported += 1;
      warnings.push(`Unsupported file skipped: ${path.basename(filePath)}`);
      continue;
    }

    const adapter = findAdapter(filePath, adapters);
    if (!adapter) {
      failed.push({ sourceFile: filePath, reason: `No adapter found for ${ext}` });
      continue;
    }

    try {
      converted.push(await normalizeSourceFile({
        filePath,
        outputDir: dirs.outputDir,
        documentType: dirs.documentType,
        clientId: scope.clientId,
        adapters
      }));
    } catch (error) {
      failed.push({ sourceFile: filePath, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return {
    clientId: scope.clientId,
    discovered: files.length,
    counts,
    converted,
    warnings,
    failed,
    outputDir: dirs.outputDir
  };
}
