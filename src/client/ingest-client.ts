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

const knownExtensions = new Set([".md", ".docx", ".xlsx", ".yaml", ".yml", ".doc"]);

function findAdapter(filePath: string, adapters: DocumentAdapter[]): DocumentAdapter | undefined {
  return adapters.find((adapter) => adapter.supports(filePath));
}

function outputPaths(scope: ClientScope, sourceFile: string): { markdownPath: string; metadataPath: string } {
  const baseName = path.basename(sourceFile, path.extname(sourceFile));
  const markdownPath = path.join(scope.normalizedDir, `${baseName}.md`);
  const metadataPath = path.join(scope.normalizedDir, `${baseName}.metadata.json`);
  assertPathInside(markdownPath, scope.normalizedDir);
  assertPathInside(metadataPath, scope.normalizedDir);
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

export async function ingestClient(scope: ClientScope, adapters = defaultDocumentAdapters()): Promise<ClientIngestResult> {
  await ensureClientScope(scope);
  const entries = await fs.readdir(scope.sourceDir, { withFileTypes: true }).catch(() => []);
  const files = entries.filter((entry) => entry.isFile()).map((entry) => path.join(scope.sourceDir, entry.name));
  const counts: Record<string, number> = { docx: 0, doc: 0, xlsx: 0, markdown: 0, unsupported: 0 };
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
      const { markdownPath, metadataPath } = outputPaths(scope, filePath);
      const document = await adapter.parse(filePath, {
        documentType: "sop",
        clientId: scope.clientId,
        normalizedFile: markdownPath
      });
      document.sourceFile = filePath;
      document.normalizedFile = markdownPath;
      await fs.writeFile(markdownPath, normalizedToMarkdown(document), "utf8");
      await fs.writeFile(metadataPath, `${JSON.stringify(metadataFor(document), null, 2)}\n`, "utf8");
      converted.push({
        sourceFile: filePath,
        normalizedFile: markdownPath,
        metadataFile: metadataPath,
        fileType: document.fileType,
        blocks: document.blocks.length
      });
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
    outputDir: scope.normalizedDir
  };
}
