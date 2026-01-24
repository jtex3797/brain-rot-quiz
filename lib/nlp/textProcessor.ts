/**
 * 텍스트 전처리 모듈
 * 문장 분리, 핵심 문장 추출, 중복 제거 등
 */

import { tokenize, detectLanguage } from './koreanTokenizer';
import { calculateAllSentenceScores } from './tfidf';
import { logger } from '@/lib/utils/logger';

// =====================================================
// Types
// =====================================================

export interface ScoredSentence {
  text: string;
  score: number;
  keywords: string[];
  position: number; // 0-1 사이 값 (원문 내 위치)
}

export interface ProcessedText {
  originalLength: number;
  sentences: ScoredSentence[];
  topSentences: string[];
  language: 'ko' | 'en' | 'mixed';
  extractionRatio: number;
}

// =====================================================
// 문장 분리
// =====================================================

/**
 * 텍스트를 문장 단위로 분리
 * 한국어와 영어 모두 지원
 */
export function splitSentences(text: string): string[] {
  // 문장 종결 패턴: 마침표, 물음표, 느낌표 + 공백 또는 줄바꿈
  const sentencePattern = /[.!?。]+[\s\n]+|[.!?。]+$/g;

  // 줄바꿈으로 먼저 분리 (문단 구분)
  const paragraphs = text.split(/\n+/);

  const sentences: string[] = [];

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    // 문장 종결 부호로 분리
    const parts = trimmed.split(sentencePattern);

    for (const part of parts) {
      const sentence = part.trim();
      // 최소 10자 이상인 문장만 포함
      if (sentence.length >= 10) {
        sentences.push(sentence);
      }
    }
  }

  return sentences;
}

// =====================================================
// 유사도 계산 및 중복 제거
// =====================================================

/**
 * 두 문장의 유사도 계산 (Jaccard similarity)
 */
function calculateSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 유사한 문장 중복 제거 (80% 이상 유사도)
 */
export function removeDuplicateSentences(
  sentences: ScoredSentence[],
  threshold: number = 0.8
): ScoredSentence[] {
  if (sentences.length === 0) return [];

  const result: ScoredSentence[] = [];
  const tokenCache = new Map<string, string[]>();

  // 토큰 캐싱
  for (const sentence of sentences) {
    tokenCache.set(sentence.text, tokenize(sentence.text));
  }

  for (const sentence of sentences) {
    const tokens = tokenCache.get(sentence.text)!;
    let isDuplicate = false;

    for (const existing of result) {
      const existingTokens = tokenCache.get(existing.text)!;
      const similarity = calculateSimilarity(tokens, existingTokens);

      if (similarity >= threshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(sentence);
    }
  }

  return result;
}

// =====================================================
// 핵심 문장 추출
// =====================================================

/**
 * 동적으로 추출할 문장 개수 계산
 * - 텍스트 길이 기반: min(문장수, max(10, 문장수 * 0.4))
 */
function calculateExtractCount(totalSentences: number): number {
  if (totalSentences <= 5) return totalSentences;
  return Math.min(totalSentences, Math.max(10, Math.floor(totalSentences * 0.4)));
}

/**
 * 상위 N개 핵심 문장 추출
 */
export function extractTopSentences(
  sentences: ScoredSentence[],
  count?: number
): ScoredSentence[] {
  if (sentences.length === 0) return [];

  const extractCount = count ?? calculateExtractCount(sentences.length);

  // 점수 기준 내림차순 정렬
  const sorted = [...sentences].sort((a, b) => b.score - a.score);

  // 상위 N개 선택
  const top = sorted.slice(0, extractCount);

  // 원래 순서대로 재정렬 (position 기준)
  return top.sort((a, b) => a.position - b.position);
}

// =====================================================
// 메인 처리 함수
// =====================================================

/**
 * 텍스트 전체 처리 파이프라인
 * 1. 문장 분리
 * 2. 토큰화 및 TF-IDF 점수 계산
 * 3. 중복 제거
 * 4. 핵심 문장 추출
 */
export function processText(text: string): ProcessedText {
  const startTime = Date.now();
  const originalLength = text.length;
  const language = detectLanguage(text);

  logger.debug('NLP', `언어 감지: ${language}`);

  // 1. 문장 분리
  const splitStart = Date.now();
  const rawSentences = splitSentences(text);
  logger.debug('NLP', `문장 분리 완료 (${Date.now() - splitStart}ms)`, {
    '문장 수': rawSentences.length,
  });

  if (rawSentences.length === 0) {
    logger.warn('NLP', '문장을 찾을 수 없음');
    return {
      originalLength,
      sentences: [],
      topSentences: [],
      language,
      extractionRatio: 0,
    };
  }

  // 2. 토큰화
  const tokenStart = Date.now();
  const tokenizedSentences = rawSentences.map((s) => tokenize(s));
  const totalTokens = tokenizedSentences.reduce((sum, t) => sum + t.length, 0);
  logger.debug('NLP', `토큰화 완료 (${Date.now() - tokenStart}ms)`, {
    '총 토큰 수': totalTokens,
    '평균 토큰/문장': Math.round(totalTokens / rawSentences.length),
  });

  // 3. TF-IDF 점수 계산
  const tfidfStart = Date.now();
  const scores = calculateAllSentenceScores(tokenizedSentences);
  logger.debug('NLP', `TF-IDF 계산 완료 (${Date.now() - tfidfStart}ms)`);

  // 4. ScoredSentence 배열 생성
  const scoredSentences: ScoredSentence[] = rawSentences.map((text, index) => ({
    text,
    score: scores[index] || 0,
    keywords: tokenizedSentences[index].slice(0, 5), // 상위 5개 키워드
    position: index / rawSentences.length,
  }));

  // 5. 중복 제거
  const dedupeStart = Date.now();
  const uniqueSentences = removeDuplicateSentences(scoredSentences);
  const removedCount = scoredSentences.length - uniqueSentences.length;
  logger.debug('NLP', `중복 제거 완료 (${Date.now() - dedupeStart}ms)`, {
    '제거된 문장': removedCount,
    '남은 문장': uniqueSentences.length,
  });

  // 6. 핵심 문장 추출
  const extractStart = Date.now();
  const topSentences = extractTopSentences(uniqueSentences);
  logger.debug('NLP', `핵심 문장 추출 완료 (${Date.now() - extractStart}ms)`, {
    '추출 문장 수': topSentences.length,
  });

  // 7. 추출 비율 계산
  const extractedLength = topSentences.reduce((sum, s) => sum + s.text.length, 0);
  const extractionRatio = extractedLength / originalLength;

  const totalDuration = Date.now() - startTime;
  logger.info('NLP', `📊 텍스트 처리 완료 (${totalDuration}ms)`, {
    '원본': `${originalLength}자`,
    '처리 후': `${extractedLength}자`,
    '압축률': `${Math.round((1 - extractionRatio) * 100)}%`,
    '문장': `${rawSentences.length} → ${topSentences.length}`,
  });

  return {
    originalLength,
    sentences: scoredSentences,
    topSentences: topSentences.map((s) => s.text),
    language,
    extractionRatio,
  };
}

/**
 * 텍스트 길이가 충분히 긴지 확인 (전처리 필요 여부)
 * 500자 미만이면 전처리 불필요
 */
export function shouldPreprocess(text: string): boolean {
  return text.length >= 500;
}
