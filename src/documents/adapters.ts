import type { DocumentAdapter } from "./document-adapter.js";
import { DocxDocumentAdapter } from "./docx.adapter.js";
import { MarkdownDocumentAdapter } from "./markdown.adapter.js";
import { UnsupportedDocDocumentAdapter } from "./doc.adapter.js";
import { XlsxDocumentAdapter } from "./xlsx.adapter.js";

export function defaultDocumentAdapters(): DocumentAdapter[] {
  return [
    new MarkdownDocumentAdapter(),
    new DocxDocumentAdapter(),
    new XlsxDocumentAdapter(),
    new UnsupportedDocDocumentAdapter()
  ];
}
