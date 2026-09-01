import fs from "node:fs/promises";
import path from "node:path";
import type { DocumentAdapter, DocumentParseOptions } from "./document-adapter.js";
import type { DocumentType, NormalizedBlock, NormalizedBlockType, NormalizedDocument } from "./normalized-document.js";
import { deterministicBlockId, slugId } from "./document-ids.js";
import { normalizeText } from "../../tools/normalize-document.js";

function firstScalarValue(raw: string, key: string): string | undefined {
  const match = raw.match(new RegExp(`^${key}:\\s*['"]?([^'"\\n]+)['"]?\\s*$`, "m"));
  return match?.[1]?.trim();
}

function blockFromYamlLine(line: string): { type: NormalizedBlockType; text: string; level?: number } {
  const topLevel = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
  if (topLevel) {
    const value = topLevel[2]?.trim();
    return { type: "heading", text: value ? `${topLevel[1]}: ${value}` : topLevel[1] ?? "Section", level: 2 };
  }

  const listRule = line.match(/^\s*-\s+id:\s*(.+)$/);
  if (listRule) return { type: "heading", text: `Rule ${listRule[1]!.trim()}`, level: 3 };

  const bullet = line.match(/^\s*-\s+(.+)$/);
  if (bullet) return { type: "bullet", text: normalizeText(bullet[1] ?? "") };

  return { type: "paragraph", text: normalizeText(line) };
}

export class YamlDocumentAdapter implements DocumentAdapter {
  supports(filePath: string): boolean {
    return [".yaml", ".yml"].includes(path.extname(filePath).toLowerCase());
  }

  async parse(filePath: string, options: DocumentType | DocumentParseOptions): Promise<NormalizedDocument> {
    if (!this.supports(filePath)) throw new Error(`YamlDocumentAdapter only supports .yaml/.yml files: ${filePath}`);
    const parseOptions = typeof options === "string" ? { documentType: options } : options;
    const raw = await fs.readFile(filePath, "utf8");
    const documentId = slugId(filePath, parseOptions.documentType);
    const title = firstScalarValue(raw, "name") ?? firstScalarValue(raw, "title") ?? path.basename(filePath, path.extname(filePath));
    const blocks: NormalizedBlock[] = [];
    let currentSection = title;

    const titleBlockId = deterministicBlockId(documentId, blocks.length);
    blocks.push({
      blockId: titleBlockId,
      type: "heading",
      text: title,
      level: 1,
      location: { section: title, blockId: titleBlockId }
    });

    for (const [lineIndex, rawLine] of raw.replace(/\r\n?/g, "\n").split("\n").entries()) {
      const line = rawLine.trimEnd();
      if (!line.trim() || line.trim() === "---") continue;
      const parsed = blockFromYamlLine(line);
      if (!parsed.text) continue;
      if (parsed.type === "heading") currentSection = parsed.text;
      const blockId = deterministicBlockId(documentId, blocks.length);
      blocks.push({
        blockId,
        type: parsed.type,
        text: parsed.text,
        level: parsed.level,
        location: {
          section: currentSection,
          paragraphIndex: lineIndex + 1,
          blockId
        }
      });
    }

    return {
      documentId,
      clientId: parseOptions.clientId,
      sourceFile: filePath,
      normalizedFile: parseOptions.normalizedFile,
      fileName: path.basename(filePath),
      fileType: "yaml",
      documentType: parseOptions.documentType,
      title,
      blocks,
      fullText: blocks.map((block) => block.text).join("\n")
    };
  }
}
