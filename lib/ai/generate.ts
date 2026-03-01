import { generateObject } from 'ai';
import { getModelsByPriority, getModelByName } from './models';
import { SYSTEM_PROMPT, createUserPrompt, QuizSchema } from './prompts';
import { processText, shouldPreprocess } from '@/lib/nlp';
import {
  getCachedQuiz,
  setCachedQuiz,
  hashContent,
  hashOptions,
  type CacheOptions,
} from '@/lib/cache';
import { getModelDisplayName } from '@/lib/constants';
import { logger } from '@/lib/utils/logger';
import type { Quiz, QuizGenerationOptions, QuizGenerationResult, AIError, AIModel } from '@/types';

// =====================================================
// 확장된 결과 타입
// =====================================================

export interface HybridQuizResult extends QuizGenerationResult {
  cached: boolean;
  preprocessed: boolean;
  originalLength?: number;
  processedLength?: number;
}

// =====================================================
// 메인 진입점: 하이브리드 퀴즈 생성
// =====================================================

/**
 * 하이브리드 퀴즈 생성
 *
 * 파이프라인:
 * 1. 텍스트 길이 체크 (500자 미만 → AI 직접 전송)
 * 2. 캐시 확인 (bypassCache가 아닌 경우)
 * 3. NLP 전처리 (500자 이상)
 * 4. AI 생성
 * 5. 캐시 저장
 */
export async function generateQuiz(
  content: string,
  options: QuizGenerationOptions & CacheOptions
): Promise<HybridQuizResult> {
  const originalLength = content.length;

  // 1. 짧은 텍스트는 전처리 없이 바로 AI 생성
  if (!shouldPreprocess(content)) {
    logger.info('NLP', `짧은 텍스트 (${originalLength}자) - 전처리 생략`);
    const result = await generateQuizWithFallback(content, options);
    return {
      ...result,
      cached: false,
      preprocessed: false,
      originalLength,
    };
  }

  // 2. 캐시 확인 (bypassCache가 아닌 경우)
  if (!options.bypassCache) {
    try {
      const contentHash = await hashContent(content);
      const optionsHash = await hashOptions(options);
      const cached = await getCachedQuiz(contentHash, optionsHash);

      if (cached) {
        logger.logCache(true, contentHash);
        return {
          quiz: cached.quiz,
          model: cached.model + ' (cached)',
          cached: true,
          preprocessed: false,
          originalLength,
          processedLength: cached.processedTextLength,
        };
      }
      logger.logCache(false, contentHash);
    } catch (error) {
      logger.warn('Cache', '캐시 조회 실패', { error: String(error) });
    }
  }

  // 3. NLP 전처리
  const nlpStartTime = Date.now();
  logger.info('NLP', `텍스트 전처리 시작 (${originalLength}자)`);

  const processed = processText(content);
  const condensedText = processed.topSentences.join('\n\n');
  const processedLength = condensedText.length;
  const nlpDuration = Date.now() - nlpStartTime;

  logger.logTextAnalysis({
    originalLength,
    sentenceCount: processed.sentences.length,
    processedLength,
    language: processed.language,
    extractionRatio: processed.extractionRatio,
  });
  logger.info('NLP', `전처리 완료 (${nlpDuration}ms)`, {
    '추출 문장 수': processed.topSentences.length,
    '압축': `${originalLength}자 → ${processedLength}자`,
  });

  // 4. AI 생성 (축소된 텍스트)
  const result = await generateQuizWithFallback(condensedText, options);

  // 5. 캐시 저장
  if (!options.bypassCache) {
    try {
      const contentHash = await hashContent(content);
      const optionsHash = await hashOptions(options);
      await setCachedQuiz(contentHash, optionsHash, {
        quiz: result.quiz,
        model: result.model,
        processedTextLength: processedLength,
      });
      logger.info('Cache', `캐시 저장 완료 [${contentHash.slice(0, 8)}...]`);
    } catch (error) {
      logger.warn('Cache', '캐시 저장 실패', { error: String(error) });
    }
  }

  return {
    ...result,
    cached: false,
    preprocessed: true,
    originalLength,
    processedLength,
  };
}

/**
 * 멀티 모델 폴백으로 퀴즈 생성
 *
 * PRD 3.2 폴백 전략:
 * 1. Gemini 2.0 Flash 시도
 * 2. 실패 시 GPT-4o mini 시도
 * 3. 최종적으로 Claude 3.5 Haiku 시도
 */
export async function generateQuizWithFallback(
  content: string,
  options: QuizGenerationOptions
): Promise<QuizGenerationResult> {
  const isStrict = !!(options.preferredModel && options.preferredModel !== 'auto');
  const models = isStrict
    ? [getModelByName(options.preferredModel!)].filter((m): m is AIModel => !!m)
    : getModelsByPriority();
  const errors: AIError[] = [];

  logger.info('AI', `AI 모델 호출 시작 (입력 ${content.length}자, ${options.questionCount}문제 요청)`);

  for (const model of models) {
    const aiStartTime = Date.now();
    try {
      logger.info('AI', `🤖 ${model.name} 시도 중...`);

      const result = await generateObject({
        model: model.provider,
        schema: QuizSchema,
        system: SYSTEM_PROMPT,
        prompt: createUserPrompt(content, options),
        maxRetries: 0, // SDK 자동 재시도 비활성화 (다중 모델 폴백이 대신 처리)
      });

      const aiDuration = Date.now() - aiStartTime;

      // 성공!
      logger.logAICall({
        model: model.name,
        inputTokens: result.usage?.inputTokens,
        outputTokens: result.usage?.outputTokens,
        totalTokens: result.usage?.totalTokens,
        durationMs: aiDuration,
      });

      const quiz: Quiz = {
        id: crypto.randomUUID(),
        title: result.object.title,
        questions: result.object.questions
          .slice(0, options.questionCount) // 요청한 개수만큼 자르기
          .map((q) => ({
            ...q,
            // OpenAI strict mode는 nullable() 반환 → 내부 타입(undefined)으로 변환
            options: q.options ?? undefined,
            explanation: q.explanation ?? undefined,
            correctAnswers: q.correctAnswers,
          })),
        createdAt: new Date(),
      };

      logger.info('AI', `✅ 퀴즈 생성 성공`, {
        '문제 수': quiz.questions.length,
        '소요시간': `${aiDuration}ms`,
      });

      return {
        quiz,
        model: model.name,
        tokensUsed: result.usage?.totalTokens,
      };
    } catch (error: unknown) {
      const aiDuration = Date.now() - aiStartTime;
      const err = error as { message?: string };
      logger.error('AI', `❌ ${model.name} 실패 (${aiDuration}ms)`, {
        error: err.message || String(error),
      });

      // [I-12] Strict 모드: 지정 모델 실패 시 즉시 에러 반환 (classifyError 이전)
      if (isStrict) {
        throw new Error(
          `${getModelDisplayName(model.name)} 모델 사용 중 오류가 발생했습니다. 다른 모델을 선택하거나 자동 모드를 사용해주세요.`
        );
      }

      // 에러 분류
      const aiError: AIError = classifyError(error, model.name);
      errors.push(aiError);

      // Rate Limit 에러가 아니면 다음 모델로 폴백하지 않음
      if (aiError.code !== 'RATE_LIMIT') {
        // API 키 에러 등은 바로 throw
        if (aiError.code === 'INVALID_API_KEY') {
          throw new Error(`API 키가 유효하지 않습니다 (${model.name}). .env.local 파일을 확인해주세요.`);
        }
      }

      // 마지막 모델이면 에러 throw
      if (model.priority === models[models.length - 1]?.priority) {
        throw new Error(
          `모든 AI 모델이 실패했습니다.\n\n` +
          errors.map((e) => `- ${e.modelAttempted}: ${e.message}`).join('\n')
        );
      }

      // 다음 모델로 계속 시도
      logger.warn('AI', `다음 모델로 폴백...`);
      continue;
    }
  }

  throw new Error('퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
}

/**
 * 에러 분류
 */
function classifyError(error: unknown, modelName: string): AIError {
  const err = error as { message?: string; status?: number };
  const errorMessage = err.message || String(error);

  // Rate Limit (429)
  if (err.status === 429 || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return {
      code: 'RATE_LIMIT',
      message: '요청 한도를 초과했습니다',
      modelAttempted: modelName,
    };
  }

  // Invalid API Key (401, 403)
  if (
    err.status === 401 ||
    err.status === 403 ||
    errorMessage.includes('api key') ||
    errorMessage.includes('unauthorized')
  ) {
    return {
      code: 'INVALID_API_KEY',
      message: 'API 키가 유효하지 않습니다',
      modelAttempted: modelName,
    };
  }

  // Network Error
  if (
    errorMessage.includes('network') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('ECONNREFUSED')
  ) {
    return {
      code: 'NETWORK_ERROR',
      message: '네트워크 오류가 발생했습니다',
      modelAttempted: modelName,
    };
  }

  // Unknown Error
  return {
    code: 'UNKNOWN',
    message: errorMessage.substring(0, 100),
    modelAttempted: modelName,
  };
}

/**
 * 퀴즈 문제 정규화
 * - OX 문제: options를 ["O", "X"]로 자동 설정
 * - correctAnswer 정규화: "O"/"X" 또는 "true"/"false" 처리
 */
export function normalizeQuiz(quiz: Quiz): Quiz {
  return {
    ...quiz,
    questions: quiz.questions.map((q) => {
      if (q.type === 'ox') {
        // OX 문제의 options 강제 설정
        const normalizedOptions = ['O', 'X'];

        // correctAnswers[0] 정규화 (다양한 형식 처리)
        let normalizedAnswer = q.correctAnswers[0];
        const answerLower = normalizedAnswer.toLowerCase().trim();
        if (answerLower === 'true' || answerLower === '참' || answerLower === 'o') {
          normalizedAnswer = 'O';
        } else if (answerLower === 'false' || answerLower === '거짓' || answerLower === 'x') {
          normalizedAnswer = 'X';
        }

        return {
          ...q,
          options: normalizedOptions,
          correctAnswers: [normalizedAnswer],
        };
      }
      return q;
    }),
  };
}

/**
 * 퀴즈 유효성 검증
 */
export function validateQuiz(quiz: Quiz): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!quiz.title || quiz.title.trim().length === 0) {
    errors.push('퀴즈 제목이 없습니다');
  }

  if (!quiz.questions || quiz.questions.length === 0) {
    errors.push('문제가 없습니다');
  }

  quiz.questions.forEach((q, index) => {
    if (!q.questionText || q.questionText.trim().length === 0) {
      errors.push(`문제 ${index + 1}: 문제 텍스트가 없습니다`);
    }

    if (!q.correctAnswers || q.correctAnswers.length === 0 || q.correctAnswers[0].trim().length === 0) {
      errors.push(`문제 ${index + 1}: 정답이 없습니다`);
    }

    if (q.type === 'mcq' && (!q.options || q.options.length !== 4)) {
      errors.push(`문제 ${index + 1}: 객관식 문제는 4개의 보기가 필요합니다`);
    }

    if (q.type === 'ox' && (!q.options || q.options.length !== 2)) {
      errors.push(`문제 ${index + 1}: OX 문제는 2개의 보기가 필요합니다 (O, X)`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
