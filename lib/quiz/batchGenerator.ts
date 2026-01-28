/**
 * AI 배치 생성기
 * 여러 번 AI를 호출하여 더 많은 문제를 확보하고 중복 제거
 */

import { generateQuizWithFallback } from '@/lib/ai/generate';
import { tokenize } from '@/lib/nlp';
import { QUESTION_COUNT } from '@/lib/constants';
import type {
  Question,
  QuizGenerationOptions,
  BatchGenerationConfig,
} from '@/types';

// =====================================================
// Types
// =====================================================

export interface BatchGenerationResult {
  questions: Question[];
  totalGenerated: number;
  duplicatesRemoved: number;
  batchesUsed: number;
  tokensUsed: number;
}

// =====================================================
// 유틸리티 함수
// =====================================================

/**
 * 두 문제의 유사도 계산 (Jaccard similarity)
 */
function calculateQuestionSimilarity(q1: Question, q2: Question): number {
  const tokens1 = tokenize(q1.questionText);
  const tokens2 = tokenize(q2.questionText);

  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * 중복 문제 제거
 */
function removeDuplicateQuestions(
  questions: Question[],
  threshold: number = 0.7
): Question[] {
  const unique: Question[] = [];

  for (const q of questions) {
    let isDuplicate = false;

    for (const existing of unique) {
      // 유사도 체크
      if (calculateQuestionSimilarity(q, existing) >= threshold) {
        isDuplicate = true;
        break;
      }
      // 정답이 같고 문제 유형도 같으면 중복으로 처리
      if (
        q.correctAnswers[0] === existing.correctAnswers[0] &&
        q.type === existing.type
      ) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(q);
    }
  }

  return unique;
}

/**
 * 텍스트를 여러 초점 영역으로 분할
 */
function divideFocusAreas(content: string, batchCount: number): string[] {
  // 문단 단위로 분할
  const paragraphs = content
    .split(/\n\n+/)
    .filter((p) => p.trim().length > 0);

  if (paragraphs.length <= 1 || batchCount <= 1) {
    return Array(batchCount).fill(content);
  }

  // 문단을 배치 수에 맞게 그룹화
  const focusAreas: string[] = [];
  const paragraphsPerBatch = Math.ceil(paragraphs.length / batchCount);

  for (let i = 0; i < batchCount; i++) {
    const start = i * paragraphsPerBatch;
    const end = Math.min(start + paragraphsPerBatch, paragraphs.length);
    const area = paragraphs.slice(start, end).join('\n\n');

    // 빈 영역이면 전체 텍스트 사용
    focusAreas.push(area.trim() || content);
  }

  return focusAreas;
}

/**
 * 이미 생성된 문제의 토픽 추출
 */
function extractTopics(questions: Question[]): string[] {
  const topics: string[] = [];

  for (const q of questions) {
    // 문제 텍스트에서 키워드 추출
    const tokens = tokenize(q.questionText);
    topics.push(...tokens.slice(0, 3)); // 상위 3개 키워드

    // 정답도 토픽에 추가
    if (q.correctAnswers && q.correctAnswers.length > 0) {
      topics.push(q.correctAnswers[0]);
    }
  }

  return [...new Set(topics)];
}

/**
 * 배치용 프롬프트에 이전 문제 제외 지시 추가
 */
function createBatchPromptSuffix(
  existingQuestions: Question[],
  batchIndex: number
): string {
  if (existingQuestions.length === 0) {
    return '';
  }

  const topics = extractTopics(existingQuestions);
  const topicList = topics.slice(0, 10).join(', ');

  return `

**추가 지시 (배치 ${batchIndex + 1}):**
- 이미 다음 주제로 문제가 생성되었으므로, 다른 내용에서 문제를 만들어주세요: ${topicList}
- 기존 문제와 중복되지 않는 새로운 관점의 문제를 생성해주세요.`;
}

// =====================================================
// 메인 배치 생성 함수
// =====================================================

/**
 * 기본 배치 생성 설정
 */
export const DEFAULT_BATCH_CONFIG: BatchGenerationConfig = {
  targetQuestionCount: 10,
  maxBatches: QUESTION_COUNT.MAX_BATCHES,
  questionsPerBatch: QUESTION_COUNT.BATCH_SIZE,
  overproductionRatio: 1.5,
};

/**
 * AI 배치 생성
 *
 * @param content - 원본 텍스트
 * @param options - 퀴즈 생성 옵션
 * @param config - 배치 생성 설정
 * @returns 생성된 문제 목록 및 메타데이터
 */
export async function generateQuestionBatch(
  content: string,
  options: QuizGenerationOptions,
  config: Partial<BatchGenerationConfig> = {}
): Promise<BatchGenerationResult> {
  const fullConfig: BatchGenerationConfig = {
    ...DEFAULT_BATCH_CONFIG,
    ...config,
  };

  const allQuestions: Question[] = [];
  let tokensUsed = 0;
  let batchesUsed = 0;

  // 필요한 배치 수 계산
  const targetWithOverproduction = Math.ceil(
    fullConfig.targetQuestionCount * fullConfig.overproductionRatio
  );
  const batchCount = Math.min(
    Math.ceil(targetWithOverproduction / fullConfig.questionsPerBatch),
    fullConfig.maxBatches
  );

  // 초점 영역 분할
  const focusAreas = divideFocusAreas(content, batchCount);

  console.log(
    `[BatchGen] Starting batch generation: target=${fullConfig.targetQuestionCount}, batches=${batchCount}`
  );

  for (let i = 0; i < batchCount; i++) {
    try {
      // 현재 배치의 텍스트 (초점 영역 또는 전체)
      const batchContent = focusAreas[i] || content;

      // 배치별 프롬프트 접미사
      const promptSuffix = createBatchPromptSuffix(allQuestions, i);

      // 배치별 문제 수 계산
      const remaining = fullConfig.targetQuestionCount - allQuestions.length;
      const batchQuestionCount = Math.min(
        fullConfig.questionsPerBatch,
        Math.ceil(remaining * 1.5)
      );

      console.log(
        `[BatchGen] Batch ${i + 1}/${batchCount}: generating ${batchQuestionCount} questions`
      );

      // AI 생성
      const result = await generateQuizWithFallback(
        batchContent + promptSuffix,
        {
          ...options,
          questionCount: batchQuestionCount,
        }
      );

      // 결과 추가
      const newQuestions = result.quiz.questions.map((q, idx) => ({
        ...q,
        id: `batch${i}_q${idx + 1}`,
      }));

      allQuestions.push(...newQuestions);
      tokensUsed += result.tokensUsed || 0;
      batchesUsed++;

      console.log(
        `[BatchGen] Batch ${i + 1} complete: +${newQuestions.length} questions, total=${allQuestions.length}`
      );

      // 목표의 120% 도달 시 조기 종료
      if (allQuestions.length >= fullConfig.targetQuestionCount * 1.2) {
        console.log('[BatchGen] Early exit: reached 120% of target');
        break;
      }
    } catch (error) {
      console.error(`[BatchGen] Batch ${i + 1} failed:`, error);
      // 배치 실패 시 계속 진행
    }
  }

  // 중복 제거
  const uniqueQuestions = removeDuplicateQuestions(allQuestions);
  const duplicatesRemoved = allQuestions.length - uniqueQuestions.length;

  console.log(
    `[BatchGen] Complete: ${uniqueQuestions.length} unique questions (${duplicatesRemoved} duplicates removed)`
  );

  return {
    questions: uniqueQuestions.slice(0, fullConfig.targetQuestionCount),
    totalGenerated: allQuestions.length,
    duplicatesRemoved,
    batchesUsed,
    tokensUsed,
  };
}

/**
 * 단일 배치 생성 (기존 방식과 호환)
 */
export async function generateSingleBatch(
  content: string,
  options: QuizGenerationOptions
): Promise<BatchGenerationResult> {
  return generateQuestionBatch(content, options, {
    targetQuestionCount: options.questionCount,
    maxBatches: 1,
    questionsPerBatch: options.questionCount,
    overproductionRatio: 1,
  });
}
