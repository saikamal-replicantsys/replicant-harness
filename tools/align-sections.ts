import type { ExtractedSection } from "../contracts/extracted-document.js";
import type { SectionAlignment } from "../contracts/evaluation-result.js";
import { sensorThresholds } from "../scoring/scoring.config.js";
import { normalizeHeading, tokenize } from "./normalize-document.js";
import { rougeL } from "../sensors/text-similarity/rouge.js";
import { headingSimilarity } from "../sensors/structure/sections.js";

function textSimilarity(reference: string, generated: string): number {
  return rougeL(tokenize(reference), tokenize(generated));
}

export function alignSections(reference: ExtractedSection[], generated: ExtractedSection[]): SectionAlignment[] {
  const used = new Set<number>();
  return reference.map((referenceSection) => {
    let bestIndex = -1;
    let bestScore = 0;

    generated.forEach((generatedSection, index) => {
      if (used.has(index)) return;
      let score = normalizeHeading(referenceSection.heading) === normalizeHeading(generatedSection.heading)
        ? 1
        : headingSimilarity(referenceSection.heading, generatedSection.heading);
      if (score < sensorThresholds.fuzzyHeadingMatch) {
        score = Math.max(score, textSimilarity(referenceSection.content, generatedSection.content) * 0.75);
      }
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    const generatedSection = bestIndex >= 0 && (
      bestScore >= sensorThresholds.fuzzyHeadingMatch ||
      bestScore >= sensorThresholds.fallbackSectionTextMatch
    )
      ? generated[bestIndex]
      : undefined;

    if (generatedSection) used.add(bestIndex);
    return {
      referenceHeading: referenceSection.heading,
      generatedHeading: generatedSection?.heading,
      referenceSection,
      generatedSection,
      confidence: generatedSection ? bestScore : 0
    };
  });
}
