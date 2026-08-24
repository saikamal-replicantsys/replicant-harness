import type { SectionAlignment } from "../../contracts/evaluation-result.js";
import { sensorThresholds } from "../../scoring/scoring.config.js";
import { splitSentences, tokenize } from "../../tools/normalize-document.js";
import { rougeL } from "../text-similarity/rouge.js";

export interface CompletenessResult {
  referenceSentences: number;
  coveredSentences: number;
  potentiallyMissing: string[];
  potentiallyExtra: string[];
  score: number;
}

function bestSentenceScore(sentence: string, candidates: string[]): number {
  return candidates.reduce((best, candidate) => Math.max(best, rougeL(tokenize(sentence), tokenize(candidate))), 0);
}

export function completeness(alignments: SectionAlignment[]): CompletenessResult {
  const potentiallyMissing: string[] = [];
  const potentiallyExtra: string[] = [];
  let referenceSentences = 0;
  let coveredSentences = 0;

  for (const alignment of alignments) {
    const referenceSentencesInSection = splitSentences(alignment.referenceSection.content);
    const generatedSentences = splitSentences(alignment.generatedSection?.content ?? "");
    referenceSentences += referenceSentencesInSection.length;

    for (const sentence of referenceSentencesInSection) {
      const best = bestSentenceScore(sentence, generatedSentences);
      if (best >= sensorThresholds.sentenceCovered) {
        coveredSentences += 1;
      } else {
        potentiallyMissing.push(sentence);
      }
    }

    for (const sentence of generatedSentences) {
      const best = bestSentenceScore(sentence, referenceSentencesInSection);
      if (best < sensorThresholds.extraSentenceMatched) {
        potentiallyExtra.push(sentence);
      }
    }
  }

  return {
    referenceSentences,
    coveredSentences,
    potentiallyMissing,
    potentiallyExtra,
    score: referenceSentences === 0 ? 1 : coveredSentences / referenceSentences
  };
}
