import { generateObject } from 'ai';
import { getModelsByPriority } from './models';
import { SYSTEM_PROMPT, createUserPrompt, QuizSchema } from './prompts';
import { processText, shouldPreprocess } from '@/lib/nlp';
import {
  getCachedQuiz,
  setCachedQuiz,
  hashContent,
  hashOptions,
  type CacheOptions,
} from '@/lib/cache';
import type { Quiz, QuizGenerationOptions, QuizGenerationResult, AIError } from '@/types';

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
    console.log(`[Hybrid] Short text (${originalLength} chars), skipping preprocessing`);
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
        console.log(`[Hybrid] Cache HIT for content hash: ${contentHash.slice(0, 8)}...`);
        return {
          quiz: cached.quiz,
          model: cached.model + ' (cached)',
          cached: true,
          preprocessed: false,
          originalLength,
          processedLength: cached.processedTextLength,
        };
      }
      console.log(`[Hybrid] Cache MISS for content hash: ${contentHash.slice(0, 8)}...`);
    } catch (error) {
      console.error('[Hybrid] Cache lookup failed:', error);
      // 캐시 실패는 무시하고 계속 진행
    }
  }

  // 3. NLP 전처리
  console.log(`[Hybrid] Preprocessing text (${originalLength} chars)...`);
  const processed = processText(content);
  const condensedText = processed.topSentences.join('\n\n');
  const processedLength = condensedText.length;

  console.log(
    `[Hybrid] Extracted ${processed.topSentences.length} sentences, ` +
    `${originalLength} → ${processedLength} chars ` +
    `(${Math.round((1 - processed.extractionRatio) * 100)}% reduction)`
  );

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
      console.log(`[Hybrid] Cached quiz for content hash: ${contentHash.slice(0, 8)}...`);
    } catch (error) {
      console.error('[Hybrid] Cache save failed:', error);
      // 캐시 저장 실패는 무시
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
  const models = getModelsByPriority();
  const errors: AIError[] = [];

  for (const model of models) {
    try {
      console.log(`[AI] Attempting to generate quiz with ${model.name}...`);

      const result = await generateObject({
        model: model.provider,
        schema: QuizSchema,
        system: SYSTEM_PROMPT,
        prompt: createUserPrompt(content, options),
      });

      // 성공!
      console.log(`[AI] Successfully generated quiz with ${model.name}`);

      const quiz: Quiz = {
        id: crypto.randomUUID(),
        title: result.object.title,
        questions: result.object.questions.map((q) => ({
          ...q,
          correctAnswer: q.correctAnswer,
        })),
        createdAt: new Date(),
      };

      return {
        quiz,
        model: model.name,
        tokensUsed: result.usage?.totalTokens,
      };
    } catch (error: any) {
      console.error(`[AI] Error with ${model.name}:`, error);

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
      console.log(`[AI] Falling back to next model...`);
      continue;
    }
  }

  throw new Error('퀴즈 생성에 실패했습니다. 잠시 후 다시 시도해주세요.');
}

/**
 * 에러 분류
 */
function classifyError(error: any, modelName: string): AIError {
  const errorMessage = error.message || String(error);

  // Rate Limit (429)
  if (error.status === 429 || errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
    return {
      code: 'RATE_LIMIT',
      message: '요청 한도를 초과했습니다',
      modelAttempted: modelName,
    };
  }

  // Invalid API Key (401, 403)
  if (
    error.status === 401 ||
    error.status === 403 ||
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

    if (!q.correctAnswer || q.correctAnswer.trim().length === 0) {
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
