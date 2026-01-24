/**
 * Question Pool 서비스
 * DB 풀과 문제 생성 로직을 통합하는 서비스 레이어
 */

import { hashContent } from '@/lib/cache/quizCache';
import { processText } from '@/lib/nlp';
import {
  getPoolByHash,
  getOrCreatePool,
  saveQuestionsToPool,
  fetchQuestionsFromPool,
  getPoolQuestionCount,
} from '@/lib/supabase/pool';
import { generateQuestionPool } from './questionPool';
import { calculateQuestionCapacity } from './textAnalyzer';
import { logger } from '@/lib/utils/logger';
import type { Question, QuizGenerationOptions, QuestionPoolResult } from '@/types';

// =====================================================
// 상수
// =====================================================

/** 풀 최대 용량 */
const MAX_POOL_CAPACITY = 50;

/** 풀 초기 생성 비율 (최대 용량 대비) */
const INITIAL_POOL_RATIO = 0.5;

// =====================================================
// Types
// =====================================================

export interface PoolGenerationResult {
  poolId: string;
  questions: Question[];
  isFromCache: boolean;
  remainingCount: number;
  metadata?: QuestionPoolResult['metadata'];
}

// =====================================================
// 메인 함수
// =====================================================

/**
 * 문제 풀 조회 또는 생성
 *
 * 1. 기존 풀이 있고 충분한 문제가 있으면 캐시에서 반환
 * 2. 없거나 부족하면 새로 생성 후 DB에 저장
 */
export async function getOrGenerateQuestionPool(
  content: string,
  options: QuizGenerationOptions,
  requestedCount: number
): Promise<PoolGenerationResult> {
  const startTime = Date.now();

  logger.info('Pool', '🔍 문제 풀 조회/생성 시작', {
    '요청 문제 수': requestedCount,
    '텍스트 길이': content.length,
  });

  // 1. 콘텐츠 해시 생성
  const contentHash = await hashContent(content);

  // 2. 기존 풀 확인
  const existingPool = await getPoolByHash(contentHash);

  if (existingPool) {
    // 기존 풀에서 문제 조회
    const questionCount = await getPoolQuestionCount(existingPool.id);

    if (questionCount >= requestedCount) {
      logger.info('Pool', '✅ 캐시 히트! 기존 풀에서 문제 로드', {
        '풀 ID': existingPool.id,
        '저장된 문제 수': questionCount,
      });

      const { questions, remainingCount } = await fetchQuestionsFromPool(
        existingPool.id,
        requestedCount
      );

      return {
        poolId: existingPool.id,
        questions,
        isFromCache: true,
        remainingCount,
      };
    }

    logger.info('Pool', '⚠️ 풀 존재하나 문제 부족, 추가 생성 필요', {
      '현재': questionCount,
      '요청': requestedCount,
    });
  }

  // 3. 새로 생성 필요
  logger.info('Pool', '🆕 새 문제 풀 생성 시작');

  // 텍스트 분석으로 최대 용량 계산
  const processedText = processText(content);
  const capacity = calculateQuestionCapacity(content, processedText);

  // 풀 크기 결정: max(요청수, 용량의 50%), 상한 50개
  const poolSize = Math.min(
    MAX_POOL_CAPACITY,
    Math.max(requestedCount, Math.ceil(capacity.max * INITIAL_POOL_RATIO))
  );

  logger.info('Pool', '📊 풀 크기 결정', {
    '텍스트 최대 용량': capacity.max,
    '결정된 풀 크기': poolSize,
  });

  // 4. 문제 풀 생성
  const poolResult = await generateQuestionPool(content, options, {
    targetCount: poolSize,
    bypassCapacityCheck: true, // 서비스에서 이미 계산했으므로
  });

  // 5. DB에 풀 생성 또는 조회
  const createResult = await getOrCreatePool(content, capacity.max);

  if (!createResult.success || !createResult.pool) {
    logger.error('Pool', '❌ 풀 생성 실패', { error: createResult.error });
    // 풀 저장 실패해도 생성된 문제는 반환
    return {
      poolId: '',
      questions: poolResult.questions.slice(0, requestedCount),
      isFromCache: false,
      remainingCount: 0,
      metadata: poolResult.metadata,
    };
  }

  const pool = createResult.pool;

  // 6. 문제들을 DB에 저장
  const saveResult = await saveQuestionsToPool(pool.id, poolResult.questions, 'ai');

  if (!saveResult.success) {
    logger.warn('Pool', '⚠️ 문제 저장 실패, 메모리 결과만 반환', {
      error: saveResult.error,
    });
  } else {
    logger.info('Pool', '💾 문제 저장 완료', {
      '저장된 수': saveResult.savedCount,
    });
  }

  // DB ID가 포함된 문제 사용 (더 풀기 기능에서 excludeIds 매칭을 위해 필수)
  const questionsToReturn = saveResult.savedQuestions ?? poolResult.questions;

  const elapsedMs = Date.now() - startTime;
  logger.info('Pool', `🎱 풀 생성 완료 (${elapsedMs}ms)`, {
    '풀 ID': pool.id,
    '생성된 문제': poolResult.questions.length,
    '반환할 문제': Math.min(requestedCount, questionsToReturn.length),
    'DB ID 사용': !!saveResult.savedQuestions,
  });

  return {
    poolId: pool.id,
    questions: questionsToReturn.slice(0, requestedCount),
    isFromCache: false,
    remainingCount: Math.max(0, questionsToReturn.length - requestedCount),
    metadata: poolResult.metadata,
  };
}

/**
 * 추가 문제 로드 (더 풀기)
 *
 * @param poolId 풀 ID
 * @param count 가져올 문제 수
 * @param excludeIds 제외할 문제 ID (로그인 사용자: 이미 푼 문제)
 * @param random 랜덤 추출 여부 (비로그인 사용자용)
 */
export async function loadMoreQuestions(
  poolId: string,
  count: number,
  excludeIds: string[] = [],
  random: boolean = false
): Promise<{ questions: Question[]; remainingCount: number }> {
  logger.info('Pool', '📥 추가 문제 로드', {
    '풀 ID': poolId,
    '요청 수': count,
    '제외 ID 수': excludeIds.length,
    '랜덤': random,
  });

  const result = await fetchQuestionsFromPool(poolId, count, excludeIds, random);

  logger.info('Pool', '✅ 추가 문제 로드 완료', {
    '로드된 수': result.questions.length,
    '남은 수': result.remainingCount,
  });

  return result;
}

/**
 * 풀의 남은 문제 수 조회
 */
export async function getRemainingQuestionCount(
  poolId: string,
  excludeIds: string[] = []
): Promise<number> {
  const totalCount = await getPoolQuestionCount(poolId);
  return Math.max(0, totalCount - excludeIds.length);
}
