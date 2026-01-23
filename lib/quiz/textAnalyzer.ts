/**
 * 텍스트 품질 분석기
 * 텍스트 양/질에 따라 최대 생성 가능한 문제 수를 계산
 */

import { processText, tokenize, type ProcessedText } from '@/lib/nlp';

// =====================================================
// Types
// =====================================================

export interface TextQualityMetrics {
  characterCount: number;
  sentenceCount: number;
  uniqueKeywordCount: number;
  avgSentenceLength: number;
  informationDensity: number; // 0-1
  language: 'ko' | 'en' | 'mixed';
}

export interface QuestionCapacity {
  min: number;
  max: number;
  optimal: number;
  reason: string;
}

// =====================================================
// 상수
// =====================================================

const CAPACITY_CONSTANTS = {
  CHARS_PER_QUESTION: 100,
  SENTENCES_PER_QUESTION: 0.67, // 1.5 문장당 1문제
  KEYWORDS_PER_QUESTION: 10,
  MIN_CAPACITY: 1,
  MAX_CAPACITY: 50,
} as const;

// =====================================================
// 정보 밀도 계산
// =====================================================

/**
 * 텍스트의 정보 밀도 계산
 * 고유 토큰 비율 + 의미있는 토큰 밀도 기반
 */
function calculateInformationDensity(
  tokens: string[],
  totalChars: number
): number {
  if (tokens.length === 0 || totalChars === 0) return 0;

  // 고유 토큰 비율
  const uniqueTokens = new Set(tokens);
  const uniqueRatio = uniqueTokens.size / tokens.length;

  // 의미있는 토큰 밀도 (토큰 수 / 문자 수의 정규화 값)
  const meaningfulDensity = Math.min(1, tokens.length / (totalChars / 10));

  // 가중 평균 (고유 비율 60%, 밀도 40%)
  return Math.min(1, uniqueRatio * 0.6 + meaningfulDensity * 0.4);
}

// =====================================================
// 텍스트 품질 메트릭 분석
// =====================================================

/**
 * 텍스트 품질 메트릭 계산
 */
export function analyzeTextQuality(
  text: string,
  processedText?: ProcessedText
): TextQualityMetrics {
  // ProcessedText가 없으면 직접 처리
  const processed = processedText ?? processText(text);

  // 전체 텍스트 토큰화
  const allTokens = tokenize(text);
  const uniqueKeywords = new Set(allTokens);

  // 평균 문장 길이
  const avgSentenceLength =
    processed.sentences.length > 0
      ? text.length / processed.sentences.length
      : text.length;

  // 정보 밀도
  const informationDensity = calculateInformationDensity(allTokens, text.length);

  return {
    characterCount: text.length,
    sentenceCount: processed.sentences.length,
    uniqueKeywordCount: uniqueKeywords.size,
    avgSentenceLength,
    informationDensity,
    language: processed.language,
  };
}

// =====================================================
// 최대 문제 수 계산
// =====================================================

/**
 * 제한 이유 메시지 생성
 */
function generateCapacityReason(
  metrics: TextQualityMetrics,
  maxCapacity: number
): string {
  if (metrics.characterCount < 100) {
    return '텍스트가 너무 짧습니다. 더 긴 내용을 입력해주세요.';
  }

  if (metrics.sentenceCount < 3) {
    return '문장이 너무 적습니다. 더 많은 내용을 입력해주세요.';
  }

  if (metrics.uniqueKeywordCount < 10) {
    return '다양한 키워드가 부족합니다. 더 풍부한 내용을 입력해주세요.';
  }

  if (metrics.informationDensity < 0.3) {
    return '정보 밀도가 낮습니다. 반복되는 내용을 줄여주세요.';
  }

  if (maxCapacity >= 20) {
    return '충분한 양의 텍스트입니다!';
  }

  return `현재 텍스트로는 최대 ${maxCapacity}개의 문제를 생성할 수 있습니다.`;
}

/**
 * 텍스트 품질에 따른 문제 생성 용량 계산
 *
 * 공식:
 * - 문장 기반: 문장수 × 1.5
 * - 키워드 기반: 고유 키워드수 / 10
 * - 문자 기반: 문자수 / 100
 * - 최종: min(위 3개) × 정보밀도 가중치
 */
export function calculateQuestionCapacity(
  text: string,
  processedText?: ProcessedText
): QuestionCapacity {
  const metrics = analyzeTextQuality(text, processedText);

  // 각 기준별 최대 문제 수 계산
  const sentenceBasedMax = Math.floor(
    metrics.sentenceCount / CAPACITY_CONSTANTS.SENTENCES_PER_QUESTION
  );
  const keywordBasedMax = Math.floor(
    metrics.uniqueKeywordCount / CAPACITY_CONSTANTS.KEYWORDS_PER_QUESTION
  );
  const charBasedMax = Math.floor(
    metrics.characterCount / CAPACITY_CONSTANTS.CHARS_PER_QUESTION
  );

  // 가장 보수적인 값 선택
  const rawMax = Math.min(sentenceBasedMax, keywordBasedMax, charBasedMax);

  // 정보 밀도 가중치 (0.5 ~ 1.0)
  const densityMultiplier = 0.5 + metrics.informationDensity * 0.5;
  const adjustedMax = Math.floor(rawMax * densityMultiplier);

  // 범위 제한
  const max = Math.max(
    CAPACITY_CONSTANTS.MIN_CAPACITY,
    Math.min(CAPACITY_CONSTANTS.MAX_CAPACITY, adjustedMax)
  );

  // 최소값은 최대값의 30%
  const min = Math.max(
    CAPACITY_CONSTANTS.MIN_CAPACITY,
    Math.floor(max * 0.3)
  );

  // 최적값은 중간값
  const optimal = Math.floor((min + max) / 2);

  return {
    min,
    max,
    optimal,
    reason: generateCapacityReason(metrics, max),
  };
}

// =====================================================
// 편의 함수
// =====================================================

/**
 * 빠른 용량 확인 (ProcessedText 없이)
 */
export function quickCapacityCheck(text: string): QuestionCapacity {
  return calculateQuestionCapacity(text);
}

/**
 * 요청된 문제 수가 용량 내인지 확인
 */
export function isWithinCapacity(
  text: string,
  requestedCount: number
): { valid: boolean; capacity: QuestionCapacity } {
  const capacity = calculateQuestionCapacity(text);
  return {
    valid: requestedCount <= capacity.max,
    capacity,
  };
}
