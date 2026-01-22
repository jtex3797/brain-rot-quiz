/**
 * TF-IDF (Term Frequency - Inverse Document Frequency) 알고리즘 구현
 * 문장의 중요도를 계산하여 핵심 문장을 추출하는 데 사용
 */

/**
 * Term Frequency 계산
 * 특정 단어가 문서 내에서 얼마나 자주 등장하는지 계산
 */
export function calculateTF(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  const totalTokens = tokens.length;

  if (totalTokens === 0) return tf;

  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // 정규화: 빈도수를 전체 토큰 수로 나눔
  for (const [term, count] of tf) {
    tf.set(term, count / totalTokens);
  }

  return tf;
}

/**
 * Inverse Document Frequency 계산
 * 특정 단어가 전체 문서들에서 얼마나 희귀한지 계산
 * 흔한 단어일수록 낮은 점수, 희귀한 단어일수록 높은 점수
 */
export function calculateIDF(documents: string[][]): Map<string, number> {
  const idf = new Map<string, number>();
  const totalDocs = documents.length;

  if (totalDocs === 0) return idf;

  // 각 단어가 몇 개의 문서에 등장하는지 계산
  const docFrequency = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTerms = new Set(doc);
    for (const term of uniqueTerms) {
      docFrequency.set(term, (docFrequency.get(term) || 0) + 1);
    }
  }

  // IDF 계산: log(전체 문서 수 / 해당 단어가 등장한 문서 수)
  for (const [term, df] of docFrequency) {
    idf.set(term, Math.log((totalDocs + 1) / (df + 1)) + 1); // smoothing 적용
  }

  return idf;
}

/**
 * 단일 문장의 TF-IDF 점수 계산
 */
export function calculateSentenceTFIDF(
  sentenceTokens: string[],
  allDocuments: string[][],
  idfCache?: Map<string, number>
): number {
  if (sentenceTokens.length === 0) return 0;

  const tf = calculateTF(sentenceTokens);
  const idf = idfCache || calculateIDF(allDocuments);

  let score = 0;
  for (const [term, tfValue] of tf) {
    const idfValue = idf.get(term) || 1;
    score += tfValue * idfValue;
  }

  return score;
}

/**
 * 모든 문장의 TF-IDF 점수를 계산하여 반환
 */
export function calculateAllSentenceScores(
  tokenizedSentences: string[][]
): number[] {
  if (tokenizedSentences.length === 0) return [];

  // IDF는 한 번만 계산
  const idf = calculateIDF(tokenizedSentences);

  return tokenizedSentences.map((tokens) =>
    calculateSentenceTFIDF(tokens, tokenizedSentences, idf)
  );
}
