function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  const total = Math.max(tokens.length, 1);
  for (const [token, count] of counts) counts.set(token, count / total);
  return counts;
}

export function tfidfCosineSimilarity(referenceTokens: string[], generatedTokens: string[]): number {
  const docs = [referenceTokens, generatedTokens];
  const vocabulary = Array.from(new Set(docs.flat()));
  const vectors = docs.map((tokens) => {
    const tf = termFrequency(tokens);
    return vocabulary.map((term) => {
      const containingDocs = docs.filter((doc) => doc.includes(term)).length;
      const idf = Math.log((docs.length + 1) / (containingDocs + 1)) + 1;
      return (tf.get(term) ?? 0) * idf;
    });
  });

  const [a, b] = vectors;
  if (!a || !b) return 0;
  const dot = a.reduce((sum, value, index) => sum + value * (b[index] ?? 0), 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));
  if (normA === 0 && normB === 0) return 1;
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}
