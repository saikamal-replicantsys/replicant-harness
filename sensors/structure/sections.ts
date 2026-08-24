import type { ExtractedHeading, ExtractedSection } from "../../contracts/extracted-document.js";
import { normalizeHeading, tokenize } from "../../tools/normalize-document.js";
import { rougeL } from "../text-similarity/rouge.js";

export interface CoverageResult {
  referenceCount: number;
  generatedCount: number;
  matched: number;
  missing: string[];
  extra: string[];
  score: number;
}

export function headingSimilarity(reference: string, generated: string): number {
  const left = normalizeHeading(reference);
  const right = normalizeHeading(generated);
  if (left === right) return 1;
  return rougeL(tokenize(left), tokenize(right));
}

export function sectionCoverage(reference: ExtractedSection[], generated: ExtractedSection[], threshold = 0.86): CoverageResult {
  const used = new Set<number>();
  const missing: string[] = [];
  let matched = 0;

  for (const ref of reference) {
    let bestIndex = -1;
    let bestScore = 0;
    generated.forEach((gen, index) => {
      if (used.has(index)) return;
      const score = headingSimilarity(ref.heading, gen.heading);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    if (bestIndex >= 0 && bestScore >= threshold) {
      used.add(bestIndex);
      matched += 1;
    } else {
      missing.push(ref.heading);
    }
  }

  const extra = generated.filter((_, index) => !used.has(index)).map((section) => section.heading);
  return {
    referenceCount: reference.length,
    generatedCount: generated.length,
    matched,
    missing,
    extra,
    score: reference.length === 0 ? 1 : matched / reference.length
  };
}

export function headingCoverage(reference: ExtractedHeading[], generated: ExtractedHeading[], threshold = 0.86): CoverageResult {
  const referenceSections = reference.map((heading) => ({
    heading: heading.text,
    level: heading.level,
    content: "",
    startIndex: heading.index,
    endIndex: heading.index
  }));
  const generatedSections = generated.map((heading) => ({
    heading: heading.text,
    level: heading.level,
    content: "",
    startIndex: heading.index,
    endIndex: heading.index
  }));
  return sectionCoverage(referenceSections, generatedSections, threshold);
}
