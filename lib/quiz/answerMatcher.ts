/**
 * 답안 매칭 유틸리티
 * Fuzzy matching + 정규화 기반 답안 비교
 */

import Fuse from 'fuse.js';
import { ANSWER_MATCHING } from '@/lib/constants';
import type { QuizType } from '@/types';

/**
 * 답안 매칭 결과
 */
export interface MatchResult {
  isCorrect: boolean;
  matchType: 'exact' | 'similar' | 'wrong';
  similarity: number; // 0.0 ~ 1.0
  matchedAnswer?: string; // 매칭된 정답 원문
  displayAnswer: string; // UI 표시용 (항상 correctAnswers[0])
}

// 한국어 조사 패턴 (어미 제거)
const KOREAN_JOSA_PATTERN =
  /(은|는|이|가|을|를|의|에|에서|으로|로|와|과|도)$/;

/**
 * 답안 정규화
 * trim → 다중 공백 제거 → lowercase → 문장부호 제거 → NFC 정규화 → 한국어 조사 제거
 */
export function normalizeAnswer(text: string): string {
  let normalized = text
    .trim()
    .replace(/\s+/g, ' ') // 다중 공백 → 단일 공백
    .toLowerCase()
    .replace(/[.,!?;:'"()[\]{}]/g, '') // 문장부호 제거
    .normalize('NFC'); // 한글 NFC 정규화

  // 한국어 조사 제거
  normalized = normalized.replace(KOREAN_JOSA_PATTERN, '');

  return normalized.trim();
}

/**
 * Fuse.js 기반 퍼지 매칭
 */
function fuzzyMatch(
  userAnswer: string,
  correctAnswers: string[]
): { similarity: number; matchedIndex: number } | null {
  const normalizedAnswers = correctAnswers.map(normalizeAnswer);
  const normalizedUser = normalizeAnswer(userAnswer);

  const fuse = new Fuse(normalizedAnswers, {
    includeScore: true,
    threshold: ANSWER_MATCHING.FUSE_THRESHOLD,
    distance: 100,
    ignoreLocation: true,
  });

  const results = fuse.search(normalizedUser);

  if (results.length === 0) return null;

  const best = results[0];
  const similarity = 1 - (best.score ?? 1);

  return {
    similarity,
    matchedIndex: best.refIndex,
  };
}

/**
 * 답안 체크 메인 함수
 */
export function checkAnswer(
  userAnswer: string,
  correctAnswers: string[],
  questionType?: QuizType
): MatchResult {
  const displayAnswer = correctAnswers[0];

  // 1. MCQ/OX: 정확 일치만 (fuzzy 비적용)
  if (questionType === 'mcq' || questionType === 'ox') {
    const isCorrect = correctAnswers.includes(userAnswer);
    return {
      isCorrect,
      matchType: isCorrect ? 'exact' : 'wrong',
      similarity: isCorrect ? 1.0 : 0.0,
      matchedAnswer: isCorrect ? userAnswer : undefined,
      displayAnswer,
    };
  }

  // 2. 정규화 후 정확 일치 체크
  const normalizedUser = normalizeAnswer(userAnswer);
  for (const answer of correctAnswers) {
    if (normalizeAnswer(answer) === normalizedUser) {
      return {
        isCorrect: true,
        matchType: 'exact',
        similarity: 1.0,
        matchedAnswer: answer,
        displayAnswer,
      };
    }
  }

  // 3. 짧은 답 보호: 3자 미만은 정확 일치만
  if (normalizedUser.length < ANSWER_MATCHING.MIN_LENGTH_FOR_FUZZY) {
    return {
      isCorrect: false,
      matchType: 'wrong',
      similarity: 0.0,
      displayAnswer,
    };
  }

  // 4. Fuse.js 유사도 체크
  const fuzzyResult = fuzzyMatch(userAnswer, correctAnswers);
  if (
    fuzzyResult &&
    fuzzyResult.similarity >= ANSWER_MATCHING.SIMILARITY_THRESHOLD
  ) {
    return {
      isCorrect: true,
      matchType: 'similar',
      similarity: fuzzyResult.similarity,
      matchedAnswer: correctAnswers[fuzzyResult.matchedIndex],
      displayAnswer,
    };
  }

  // 5. 그 외: 오답
  return {
    isCorrect: false,
    matchType: 'wrong',
    similarity: fuzzyResult?.similarity ?? 0.0,
    displayAnswer,
  };
}
