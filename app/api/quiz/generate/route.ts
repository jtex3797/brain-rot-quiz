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

/**
 * POST /api/quiz/generate
 *
 * 텍스트로부터 퀴즈 생성
 */
export async function POST(req: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await req.json();
    const { content, questionCount = 5, difficulty = 'medium', bypassCache = false } = body;

    // 입력 검증
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { error: ERROR_MESSAGES.CONTENT_REQUIRED },
        { status: 400 }
      );
    }

    if (content.trim().length < CONTENT_LENGTH.MIN) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.CONTENT_TOO_SHORT },
        { status: 400 }
      );
    }

    if (questionCount < QUESTION_COUNT.MIN || questionCount > QUESTION_COUNT.MAX) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_QUESTION_COUNT },
        { status: 400 }
      );
    }

    const validDifficulties: Difficulty[] = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(difficulty)) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.INVALID_DIFFICULTY },
        { status: 400 }
      );
    }

    // 퀴즈 생성 옵션
    const options = {
      questionCount,
      difficulty: difficulty as Difficulty,
      bypassCache: Boolean(bypassCache),
    };

    console.log('[API] Generating quiz...', { contentLength: content.length, options });

    // 텍스트 용량 확인
    const capacity = calculateQuestionCapacity(content);

    // 문제 수가 10개 초과이거나 용량의 80% 이상 요청 시 문제 풀 시스템 사용
    const usePoolSystem = questionCount > 10 || questionCount >= capacity.max * 0.8;

    if (usePoolSystem) {
      console.log('[API] Using question pool system for', questionCount, 'questions');

      // 문제 풀 시스템 사용
      const poolResult = await generateQuestionPool(content, options, {
        targetCount: questionCount,
        aiRatio: 0.7,
        transformRatio: 0.3,
      });

      const quiz = createQuizFromPool(poolResult, '생성된 퀴즈');

      // 퀴즈 유효성 검증
      const validation = validateQuiz(quiz);
      if (!validation.valid) {
        console.error('[API] Invalid quiz generated:', validation.errors);
        return NextResponse.json(
          { error: ERROR_MESSAGES.QUIZ_GENERATION_ERROR, details: validation.errors },
          { status: 500 }
        );
      }

      console.log('[API] Quiz generated via pool system', {
        quizId: quiz.id,
        questionCount: quiz.questions.length,
        aiGenerated: poolResult.metadata.aiGenerated,
        transformed: poolResult.metadata.transformed,
      });

      return NextResponse.json({
        success: true,
        quiz,
        model: 'pool-system',
        tokensUsed: poolResult.metadata.tokensUsed,
        // 문제 풀 메타데이터
        poolMetadata: poolResult.metadata,
        capacity,
      });
    }

    // 기존 하이브리드 퀴즈 생성 (NLP 전처리 + 캐싱 + AI 폴백)
    const result = await generateQuiz(content, options);

    // 퀴즈 유효성 검증
    const validation = validateQuiz(result.quiz);
    if (!validation.valid) {
      console.error('[API] Invalid quiz generated:', validation.errors);
      return NextResponse.json(
        { error: ERROR_MESSAGES.QUIZ_GENERATION_ERROR, details: validation.errors },
        { status: 500 }
      );
    }

    console.log('[API] Quiz generated successfully', {
      quizId: result.quiz.id,
      model: result.model,
      questionCount: result.quiz.questions.length,
      cached: result.cached,
      preprocessed: result.preprocessed,
    });

    // 성공 응답
    return NextResponse.json({
      success: true,
      quiz: result.quiz,
      model: result.model,
      tokensUsed: result.tokensUsed,
      // 하이브리드 시스템 메타데이터
      cached: result.cached,
      preprocessed: result.preprocessed,
      originalLength: result.originalLength,
      processedLength: result.processedLength,
      capacity,
    });
  } catch (error) {
    console.error('[API] Error generating quiz:', error);

    // 사용자 친화적인 에러 메시지
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
