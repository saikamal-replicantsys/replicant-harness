import path from "node:path";
import type { DocumentType } from "./normalized-document.js";

export function slugId(filePath: string, documentType: DocumentType): string {
  const base = path.basename(filePath, path.extname(filePath)).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (base.includes("DOCUMENT-CONTROL-SOP")) return "SOP-DEMO-001";
  if (base.includes("BATCH-RECORD")) return "TARGET-DEMO-001";
  return `${documentType.toUpperCase()}-${base || "DOCUMENT"}`;
}

export function deterministicBlockId(documentId: string, index: number): string {
  return `${documentId}-B${String(index + 1).padStart(3, "0")}`;
}
