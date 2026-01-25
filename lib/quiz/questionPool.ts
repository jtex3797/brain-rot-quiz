/**
 * 통합 파이프라인 - 문제 풀 생성기
 * 텍스트 분석 + AI 배치 생성 + 문제 변형을 결합
 */

import { processText } from '@/lib/nlp';
import { calculateQuestionCapacity } from './textAnalyzer';
import { generateQuestionBatch, type BatchGenerationResult } from './batchGenerator';
import {
  transformQuestions,
  DEFAULT_TRANSFORMATION_OPTIONS,
} from './questionTransformer';
import { QUESTION_COUNT } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';
import type {
  Quiz,
  QuizGenerationOptions,
  QuestionPoolResult,
  TransformationOptions,
  BatchGenerationConfig,
} from '@/types';

// =====================================================
// Types
// =====================================================

export interface QuestionPoolConfig {
  targetCount: number;
  aiRatio: number; // AI 생성 비율 (기본: 0.7)
  transformRatio: number; // 변형 문제 비율 (기본: 0.3)
  maxBatches: number;
  transformationOptions: TransformationOptions;
  bypassCapacityCheck?: boolean;
}

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 배열 셔플 (Fisher-Yates)
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// =====================================================
// 기본 설정
// =====================================================

export const DEFAULT_POOL_CONFIG: QuestionPoolConfig = {
  targetCount: 10,
  aiRatio: 0.7,
  transformRatio: 0.3,
  maxBatches: QUESTION_COUNT.MAX_BATCHES,
  transformationOptions: DEFAULT_TRANSFORMATION_OPTIONS,
  bypassCapacityCheck: false,
};

// =====================================================
// 메인 파이프라인
// =====================================================

/**
 * 문제 풀 생성 메인 함수
 *
 * 파이프라인:
 * 1. 텍스트 분석 → 최대 용량 확인
 * 2. AI 배치 생성 (목표의 70%)
 * 3. 문제 변형 (목표의 30%)
 * 4. 셔플 & 최종 선택
 */
export async function generateQuestionPool(
  content: string,
  options: QuizGenerationOptions,
  config: Partial<QuestionPoolConfig> = {}
): Promise<QuestionPoolResult> {
  const startTime = Date.now();

  const fullConfig: QuestionPoolConfig = {
    ...DEFAULT_POOL_CONFIG,
    ...config,
    targetCount: config.targetCount ?? options.questionCount,
  };

  logger.info('Pool', '🎱 문제 풀 생성 시작', {
    '목표 문제 수': fullConfig.targetCount,
    'AI 비율': `${fullConfig.aiRatio * 100}%`,
    '변형 비율': `${fullConfig.transformRatio * 100}%`,
  });

  // 1. 텍스트 분석 및 최대 문제 수 확인
  const nlpStart = Date.now();
  const processedText = processText(content);
  const capacity = calculateQuestionCapacity(content, processedText);
  logger.debug('Pool', `텍스트 분석 완료 (${Date.now() - nlpStart}ms)`, {
    '최대 용량': capacity.max,
    '최적 문제 수': capacity.optimal,
  });

  // 목표 수가 최대 용량을 초과하면 조정 (bypassCapacityCheck가 아닌 경우)
  let adjustedTarget = fullConfig.targetCount;
  if (!fullConfig.bypassCapacityCheck && adjustedTarget > capacity.max) {
    logger.warn('Pool', `목표(${adjustedTarget})가 최대 용량(${capacity.max})을 초과, 조정됨`);
    adjustedTarget = capacity.max;
  }

  // 2. AI 생성 목표 수 계산
  const aiTargetCount = Math.ceil(adjustedTarget * fullConfig.aiRatio);

  // 3. AI 배치 생성
  let batchResult: BatchGenerationResult;
  const batchStart = Date.now();

  // 10개 이하면 단일 배치, 초과면 멀티 배치
  if (aiTargetCount <= QUESTION_COUNT.BATCH_SIZE) {
    logger.info('Pool', `단일 배치 생성 (목표: ${aiTargetCount}문제)`);
    batchResult = await generateQuestionBatch(content, options, {
      targetQuestionCount: aiTargetCount,
      maxBatches: 1,
      questionsPerBatch: aiTargetCount,
      overproductionRatio: 1.2,
    });
  } else {
    const batchCount = Math.ceil(aiTargetCount / QUESTION_COUNT.BATCH_SIZE);
    logger.info('Pool', `멀티 배치 생성 (목표: ${aiTargetCount}문제, ${batchCount}배치)`);
    const batchConfig: Partial<BatchGenerationConfig> = {
      targetQuestionCount: aiTargetCount,
      maxBatches: fullConfig.maxBatches,
      questionsPerBatch: QUESTION_COUNT.BATCH_SIZE,
      overproductionRatio: 1.5,
    };
    batchResult = await generateQuestionBatch(content, options, batchConfig);
  }

  logger.info('Pool', `AI 배치 생성 완료 (${Date.now() - batchStart}ms)`, {
    '생성된 문제': batchResult.questions.length,
    '토큰 사용량': batchResult.tokensUsed,
  });

  // 4. 변형으로 추가 문제 생성
  let allQuestions = [...batchResult.questions];
  let transformedCount = 0;

  const transformTarget = adjustedTarget - allQuestions.length;
  if (transformTarget > 0 && fullConfig.transformRatio > 0) {
    const transformStart = Date.now();
    logger.info('Transform', `문제 변형 시작 (추가 목표: ${transformTarget}문제)`);

    const transformedQuestions = transformQuestions(
      batchResult.questions,
      allQuestions.length + transformTarget,
      fullConfig.transformationOptions
    );

    // transformQuestions는 원본 + 변형을 합쳐서 반환
    // 변형으로 추가된 문제 수 계산
    transformedCount = transformedQuestions.length - batchResult.questions.length;
    allQuestions = transformedQuestions;

    logger.info('Transform', `문제 변형 완료 (${Date.now() - transformStart}ms)`, {
      '추가된 문제': transformedCount,
    });
  }

  // 5. 셔플 및 최종 선택
  const shuffled = shuffleArray(allQuestions);
  const finalQuestions = shuffled.slice(0, adjustedTarget);

  // 6. ID 재할당
  finalQuestions.forEach((q, i) => {
    q.id = `q${i + 1}`;
  });

  const generationTimeMs = Date.now() - startTime;

  logger.info('Pool', `🎱 문제 풀 생성 완료 (${generationTimeMs}ms)`, {
    '최종 문제 수': finalQuestions.length,
    'AI 생성': batchResult.questions.length,
    '변형 추가': transformedCount,
    '총 토큰': batchResult.tokensUsed,
  });

  return {
    questions: finalQuestions,
    metadata: {
      aiGenerated: batchResult.questions.length,
      transformed: Math.max(0, transformedCount),
      totalAttempted: batchResult.totalGenerated + transformedCount,
      tokensUsed: batchResult.tokensUsed,
      generationTimeMs,
    },
  };
}

/**
 * 문제 풀에서 Quiz 객체 생성
 */
export function createQuizFromPool(
  poolResult: QuestionPoolResult,
  title: string
): Quiz {
  return {
    id: crypto.randomUUID(),
    title,
    questions: poolResult.questions,
    createdAt: new Date(),
  };
}

/**
 * 간편 생성 함수 (기본 설정 사용)
 */
export async function generateQuizPool(
  content: string,
  options: QuizGenerationOptions
): Promise<{ quiz: Quiz; metadata: QuestionPoolResult['metadata'] }> {
  const poolResult = await generateQuestionPool(content, options);

  const quiz = createQuizFromPool(poolResult, '생성된 퀴즈');

  return {
    quiz,
    metadata: poolResult.metadata,
  };
}
