import type { NormalizedBlock, NormalizedDocument } from "./normalized-document.js";

function tableToMarkdown(rows: string[][]): string {
  if (rows.length === 0) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => Array.from({ length: width }, (_, index) => row[index] ?? ""));
  const header = normalizedRows[0] ?? [];
  const separator = header.map(() => "---");
  return [header, separator, ...normalizedRows.slice(1)]
    .map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`)
    .join("\n");
}

function blockToMarkdown(block: NormalizedBlock): string {
  if (block.type === "heading") return `${"#".repeat(block.level ?? 2)} ${block.text}`;
  if (block.type === "bullet") return `- ${block.text}`;
  if (block.type === "numbered") return `1. ${block.text}`;
  if (block.type === "table" && block.rows) return tableToMarkdown(block.rows);
  return block.text;
}

export function normalizedToMarkdown(document: NormalizedDocument): string {
  return document.blocks.map(blockToMarkdown).filter(Boolean).join("\n\n") + "\n";
}
