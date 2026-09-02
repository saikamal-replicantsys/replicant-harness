import type { DocumentAdapter } from "./document-adapter.js";
import { DocxDocumentAdapter } from "./docx.adapter.js";
import { MarkdownDocumentAdapter } from "./markdown.adapter.js";
import { UnsupportedDocDocumentAdapter } from "./doc.adapter.js";
import { PdfDocumentAdapter } from "./pdf.adapter.js";
import { XlsxDocumentAdapter } from "./xlsx.adapter.js";
import { YamlDocumentAdapter } from "./yaml.adapter.js";

export function defaultDocumentAdapters(): DocumentAdapter[] {
  return [
    new MarkdownDocumentAdapter(),
    new YamlDocumentAdapter(),
    new DocxDocumentAdapter(),
    new PdfDocumentAdapter(),
    new XlsxDocumentAdapter(),
    new UnsupportedDocDocumentAdapter()
  ];
}
