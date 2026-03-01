/**
 * Question Bank 서비스
 * DB 은행과 문제 생성 로직을 통합하는 서비스 레이어
 */

import { hashContent } from '@/lib/cache/quizCache';
import { processText } from '@/lib/nlp';
import {
  getBankByHash,
  getOrCreateBank,
  saveQuestionsToBank,
  fetchQuestionsFromBank,
  getBankQuestionCount,
} from '@/lib/supabase/questionBank';
import { generateQuestionPool } from './questionPool';
import { calculateQuestionCapacity } from './textAnalyzer';
import { logger } from '@/lib/utils/logger';
import type { Question, QuizGenerationOptions, QuestionPoolResult } from '@/types';

// =====================================================
// 상수
// =====================================================

/** 은행 최대 용량 */
const MAX_BANK_CAPACITY = 100;

// =====================================================
// Types
// =====================================================

export interface BankGenerationResult {
  bankId: string;
  questions: Question[];
  isFromCache: boolean;
  remainingCount: number;
  metadata?: QuestionPoolResult['metadata'];
}

// =====================================================
// 메인 함수
// =====================================================

/**
 * 문제 은행 조회 또는 생성
 *
 * 1. 기존 은행이 있고 충분한 문제가 있으면 캐시에서 반환
 * 2. 없거나 부족하면 새로 생성 후 DB에 저장
 *
 * @param content 텍스트 콘텐츠
 * @param options 퀴즈 생성 옵션
 * @param sessionSize 세션당 문제 수 (반환할 문제 수)
 * @param maxGenerate 최대 생성 수 (선택적, 없으면 텍스트 용량 최대치)
 */
export async function getOrGenerateQuestionBank(
  content: string,
  options: QuizGenerationOptions,
  sessionSize: number,
  maxGenerate?: number
): Promise<BankGenerationResult> {
  const startTime = Date.now();

  // Strict 모드: 지정 모델 전용 뱅크 사용 (auto 뱅크와 분리)
  const modelKey = (options.preferredModel && options.preferredModel !== 'auto')
    ? options.preferredModel
    : undefined;

  if (modelKey) {
    logger.info('Bank', `⚡ Strict 모드 — ${modelKey} 전용 뱅크 사용`);
  }

  logger.info('Bank', '🔍 문제 은행 조회/생성 시작', {
    '세션 크기': sessionSize,
    '최대 생성': maxGenerate ?? '자동',
    '텍스트 길이': content.length,
  });

  // 1. 콘텐츠 해시 생성 (strict mode: 모델별 별도 해시)
  const hashInput = modelKey ? `${content}:${modelKey}` : content;
  const contentHash = await hashContent(hashInput);

  // 2. 기존 은행 확인
  const existingBank = await getBankByHash(contentHash);

  if (existingBank) {
    // 기존 은행에서 문제 조회
    const questionCount = await getBankQuestionCount(existingBank.id);

    if (questionCount >= sessionSize) {
      logger.info('Bank', '✅ 캐시 히트! 기존 은행에서 문제 로드', {
        '은행 ID': existingBank.id,
        '저장된 문제 수': questionCount,
      });

      // 랜덤으로 문제 선택 (매번 다른 문제가 나오도록)
      const { questions, remainingCount } = await fetchQuestionsFromBank(
        existingBank.id,
        sessionSize,
        [], // excludeIds 없음
        true // random = true
      );

      return {
        bankId: existingBank.id,
        questions,
        isFromCache: true,
        remainingCount,
      };
    }

    logger.info('Bank', '⚠️ 은행 존재하나 문제 부족, 추가 생성 필요', {
      '현재': questionCount,
      '요청': sessionSize,
    });
  }

  // 3. 새로 생성 필요
  logger.info('Bank', '🆕 새 문제 은행 생성 시작');

  // 텍스트 분석으로 최대 용량 계산
  const processedText = processText(content);
  const capacity = calculateQuestionCapacity(content, processedText);

  // 은행 크기 결정: 항상 텍스트 용량 최대치로 생성 (maxGenerate 지정 시 해당 값 사용)
  const targetGenerate = maxGenerate ?? capacity.max;
  const bankSize = Math.min(MAX_BANK_CAPACITY, targetGenerate);

  logger.info('Bank', '📊 은행 크기 결정 (최대치 생성 모드)', {
    '세션 크기': sessionSize,
    '텍스트 최대 용량': capacity.max,
    '생성 목표': bankSize,
  });

  // 4. 문제 풀 생성
  const poolResult = await generateQuestionPool(content, options, {
    targetCount: bankSize,
    bypassCapacityCheck: true, // 서비스에서 이미 계산했으므로
  });

  // 5. DB에 은행 생성 또는 조회
  const createResult = await getOrCreateBank(content, capacity.max, modelKey);

  if (!createResult.success || !createResult.bank) {
    logger.error('Bank', '❌ 은행 생성 실패', { error: createResult.error });
    // 은행 저장 실패해도 생성된 문제는 반환
    return {
      bankId: '',
      questions: poolResult.questions.slice(0, sessionSize),
      isFromCache: false,
      remainingCount: 0,
      metadata: poolResult.metadata,
    };
  }

  const bank = createResult.bank;

  // 6. 문제들을 DB에 저장
  const saveResult = await saveQuestionsToBank(bank.id, poolResult.questions, 'ai');

  if (!saveResult.success) {
    logger.warn('Bank', '⚠️ 문제 저장 실패, 메모리 결과만 반환', {
      error: saveResult.error,
    });
  } else {
    logger.info('Bank', '💾 문제 저장 완료', {
      '저장된 수': saveResult.savedCount,
    });
  }

  // DB ID가 포함된 문제 사용 (더 풀기 기능에서 excludeIds 매칭을 위해 필수)
  const questionsToReturn = saveResult.savedQuestions ?? poolResult.questions;

  const elapsedMs = Date.now() - startTime;
  logger.info('Bank', `🏦 은행 생성 완료 (${elapsedMs}ms)`, {
    '은행 ID': bank.id,
    '생성된 문제': poolResult.questions.length,
    '반환할 문제': Math.min(sessionSize, questionsToReturn.length),
    'DB ID 사용': !!saveResult.savedQuestions,
  });

  return {
    bankId: bank.id,
    questions: questionsToReturn.slice(0, sessionSize),
    isFromCache: false,
    remainingCount: Math.max(0, questionsToReturn.length - sessionSize),
    metadata: poolResult.metadata,
  };
}

/**
 * 추가 문제 로드 (더 풀기)
 *
 * @param bankId 은행 ID
 * @param count 가져올 문제 수
 * @param excludeIds 제외할 문제 ID (로그인 사용자: 이미 푼 문제)
 * @param random 랜덤 추출 여부 (비로그인 사용자용)
 */
export async function loadMoreQuestions(
  bankId: string,
  count: number,
  excludeIds: string[] = [],
  random: boolean = false
): Promise<{ questions: Question[]; remainingCount: number }> {
  logger.info('Bank', '📥 추가 문제 로드', {
    '은행 ID': bankId,
    '요청 수': count,
    '제외 ID 수': excludeIds.length,
    '랜덤': random,
  });

  const result = await fetchQuestionsFromBank(bankId, count, excludeIds, random);

  logger.info('Bank', '✅ 추가 문제 로드 완료', {
    '로드된 수': result.questions.length,
    '남은 수': result.remainingCount,
  });

  return result;
}

/**
 * 은행의 남은 문제 수 조회
 */
export async function getRemainingQuestionCount(
  bankId: string,
  excludeIds: string[] = []
): Promise<number> {
  const totalCount = await getBankQuestionCount(bankId);
  return Math.max(0, totalCount - excludeIds.length);
}

// =====================================================
// 하위 호환성을 위한 별칭 (deprecated)
// =====================================================

/** @deprecated Use BankGenerationResult instead */
export type PoolGenerationResult = BankGenerationResult;

/** @deprecated Use getOrGenerateQuestionBank instead */
export const getOrGenerateQuestionPool = getOrGenerateQuestionBank;
