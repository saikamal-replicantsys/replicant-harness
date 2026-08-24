function ngrams(tokens: string[], n: number): string[] {
  const result: string[] = [];
  for (let index = 0; index <= tokens.length - n; index += 1) {
    result.push(tokens.slice(index, index + n).join(" "));
  }
  return result;
}

function f1(overlap: number, referenceTotal: number, generatedTotal: number): number {
  if (referenceTotal === 0 && generatedTotal === 0) return 1;
  if (overlap === 0) return 0;
  const precision = overlap / Math.max(generatedTotal, 1);
  const recall = overlap / Math.max(referenceTotal, 1);
  return (2 * precision * recall) / (precision + recall);
}

function overlapCount(referenceItems: string[], generatedItems: string[]): number {
  const generatedCounts = new Map<string, number>();
  for (const item of generatedItems) generatedCounts.set(item, (generatedCounts.get(item) ?? 0) + 1);
  let overlap = 0;
  for (const item of referenceItems) {
    const count = generatedCounts.get(item) ?? 0;
    if (count > 0) {
      overlap += 1;
      generatedCounts.set(item, count - 1);
    }
  }
  return overlap;
}

export function rougeN(referenceTokens: string[], generatedTokens: string[], n: 1 | 2): number {
  const referenceNgrams = ngrams(referenceTokens, n);
  const generatedNgrams = ngrams(generatedTokens, n);
  return f1(overlapCount(referenceNgrams, generatedNgrams), referenceNgrams.length, generatedNgrams.length);
}

export function lcsLength(left: string[], right: string[]): number {
  const previous = Array(right.length + 1).fill(0);
  const current = Array(right.length + 1).fill(0);
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = left[i - 1] === right[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    }
    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }
  return previous[right.length] ?? 0;
}

export function rougeL(referenceTokens: string[], generatedTokens: string[]): number {
  return f1(lcsLength(referenceTokens, generatedTokens), referenceTokens.length, generatedTokens.length);
}
