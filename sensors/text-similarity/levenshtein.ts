export interface LevenshteinResult {
  distance: number;
  normalizedSimilarity: number;
}

export function levenshteinDistance<T>(left: T[], right: T[]): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length] ?? 0;
}

export function characterLevenshtein(reference: string, generated: string): LevenshteinResult {
  const left = Array.from(reference);
  const right = Array.from(generated);
  const distance = levenshteinDistance(left, right);
  const denominator = Math.max(left.length, right.length, 1);
  return { distance, normalizedSimilarity: 1 - distance / denominator };
}

export function wordLevenshtein(referenceTokens: string[], generatedTokens: string[]): LevenshteinResult {
  const distance = levenshteinDistance(referenceTokens, generatedTokens);
  const denominator = Math.max(referenceTokens.length, generatedTokens.length, 1);
  return { distance, normalizedSimilarity: 1 - distance / denominator };
}
