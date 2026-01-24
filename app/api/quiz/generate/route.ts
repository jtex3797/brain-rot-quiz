import { NextRequest, NextResponse } from 'next/server';
import { generateQuiz, validateQuiz } from '@/lib/ai/generate';
import {
  generateQuestionPool,
  createQuizFromPool,
  calculateQuestionCapacity,
} from '@/lib/quiz';
import {
  CONTENT_LENGTH,
  QUESTION_COUNT,
  ERROR_MESSAGES,
  type Difficulty,
} from '@/lib/constants';
import {
  logger,
  startPipeline,
  startStep,
  endStep,
  endPipeline,
} from '@/lib/utils/logger';

/**
 * POST /api/quiz/generate
 *
 * 텍스트로부터 퀴즈 생성
 */
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID().slice(0, 8);
  startPipeline(requestId);

  try {
    // 요청 본문 파싱
    startStep('요청 파싱');
    const body = await req.json();
    const { content, questionCount = 5, difficulty = 'medium', bypassCache = false } = body;
    endStep({ questionCount, difficulty, bypassCache });

    // 입력 검증
    startStep('입력 검증');
    if (!content || typeof content !== 'string') {
      endStep();
      endPipeline(false, { error: 'CONTENT_REQUIRED' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.CONTENT_REQUIRED },
        { status: 400 }
      );
    }

    if (content.trim().length < CONTENT_LENGTH.MIN) {
      endStep();
      endPipeline(false, { error: 'CONTENT_TOO_SHORT', length: content.trim().length });
      return NextResponse.json(
        { error: ERROR_MESSAGES.CONTENT_TOO_SHORT },
        { status: 400 }
      );
    }

    if (questionCount < QUESTION_COUNT.MIN || questionCount > QUESTION_COUNT.MAX) {
      endStep();
      endPipeline(false, { error: 'INVALID_QUESTION_COUNT' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_QUESTION_COUNT },
        { status: 400 }
      );
    }

    const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(difficulty)) {
      endStep();
      endPipeline(false, { error: 'INVALID_DIFFICULTY' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_DIFFICULTY },
        { status: 400 }
      );
    }
    endStep();

    // 퀴즈 생성 옵션
    const options = {
      questionCount,
      difficulty: difficulty as Difficulty,
      bypassCache: Boolean(bypassCache),
    };

    logger.info('API', '📥 요청 정보', {
      '텍스트 길이': `${content.length}자`,
      '요청 문제 수': questionCount,
      '난이도': difficulty,
      '캐시 우회': bypassCache,
    });

    // 텍스트 용량 확인
    startStep('텍스트 용량 분석');
    const capacity = calculateQuestionCapacity(content);
    endStep({
      min: capacity.min,
      max: capacity.max,
      optimal: capacity.optimal,
    });

    // 문제 수가 10개 초과이거나 용량의 80% 이상 요청 시 문제 풀 시스템 사용
    const usePoolSystem = questionCount > 10 || questionCount >= capacity.max * 0.8;
    logger.info('API', `🔀 생성 모드: ${usePoolSystem ? '문제 풀 시스템' : '하이브리드 시스템'}`);

    if (usePoolSystem) {
      // 문제 풀 시스템 사용
      startStep('문제 풀 시스템 생성');
      const poolResult = await generateQuestionPool(content, options, {
        targetCount: questionCount,
        aiRatio: 0.7,
        transformRatio: 0.3,
      });
      endStep({
        aiGenerated: poolResult.metadata.aiGenerated,
        transformed: poolResult.metadata.transformed,
        tokensUsed: poolResult.metadata.tokensUsed,
      });

      startStep('퀴즈 객체 생성');
      const quiz = createQuizFromPool(poolResult, '생성된 퀴즈');
      endStep();

      // 퀴즈 유효성 검증
      startStep('유효성 검증');
      const validation = validateQuiz(quiz);
      if (!validation.valid) {
        endStep({ valid: false });
        logger.error('API', '퀴즈 유효성 검증 실패', { errors: validation.errors });
        endPipeline(false, { error: 'VALIDATION_FAILED' });
        return NextResponse.json(
          { error: ERROR_MESSAGES.QUIZ_GENERATION_ERROR, details: validation.errors },
          { status: 500 }
        );
      }
      endStep({ valid: true, questionCount: quiz.questions.length });

      endPipeline(true, {
        quizId: quiz.id,
        questionCount: quiz.questions.length,
        model: 'pool-system',
        tokensUsed: poolResult.metadata.tokensUsed,
      });

      return NextResponse.json({
        success: true,
        quiz,
        model: 'pool-system',
        tokensUsed: poolResult.metadata.tokensUsed,
        poolMetadata: poolResult.metadata,
        capacity,
      });
    }

    // 기존 하이브리드 퀴즈 생성 (NLP 전처리 + 캐싱 + AI 폴백)
    startStep('하이브리드 퀴즈 생성');
    const result = await generateQuiz(content, options);
    endStep({
      cached: result.cached,
      preprocessed: result.preprocessed,
      tokensUsed: result.tokensUsed,
    });

    // 퀴즈 유효성 검증
    startStep('유효성 검증');
    const validation = validateQuiz(result.quiz);
    if (!validation.valid) {
      endStep({ valid: false });
      logger.error('API', '퀴즈 유효성 검증 실패', { errors: validation.errors });
      endPipeline(false, { error: 'VALIDATION_FAILED' });
      return NextResponse.json(
        { error: ERROR_MESSAGES.QUIZ_GENERATION_ERROR, details: validation.errors },
        { status: 500 }
      );
    }
    endStep({ valid: true, questionCount: result.quiz.questions.length });

    endPipeline(true, {
      quizId: result.quiz.id,
      model: result.model,
      questionCount: result.quiz.questions.length,
      cached: result.cached,
      preprocessed: result.preprocessed,
      tokensUsed: result.tokensUsed,
    });

    // 성공 응답
    return NextResponse.json({
      success: true,
      quiz: result.quiz,
      model: result.model,
      tokensUsed: result.tokensUsed,
      cached: result.cached,
      preprocessed: result.preprocessed,
      originalLength: result.originalLength,
      processedLength: result.processedLength,
      capacity,
    });
  } catch (error) {
    logger.error('API', '퀴즈 생성 실패', {
      error: error instanceof Error ? error.message : String(error),
    });
    endPipeline(false, { error: error instanceof Error ? error.message : 'UNKNOWN' });

    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.QUIZ_GENERATION_ERROR;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quiz/generate
 *
 * API 상태 확인용
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Quiz generation API is running',
    supportedDifficulties: ['easy', 'medium', 'hard'] as Difficulty[],
    questionCountRange: { min: QUESTION_COUNT.MIN, max: QUESTION_COUNT.MAX },
  });
}
