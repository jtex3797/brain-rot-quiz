import { NextRequest, NextResponse } from 'next/server';
import { generateQuizWithFallback, validateQuiz } from '@/lib/ai/generate';
import {
  CONTENT_LENGTH,
  QUESTION_COUNT,
  ERROR_MESSAGES,
  type Difficulty,
} from '@/lib/constants';
import type { QuizGenerationOptions } from '@/types';

/**
 * POST /api/quiz/generate
 *
 * 텍스트로부터 퀴즈 생성
 */
export async function POST(req: NextRequest) {
  try {
    // 요청 본문 파싱
    const body = await req.json();
    const { content, questionCount = 5, difficulty = 'medium' } = body;

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
    const options: QuizGenerationOptions = {
      questionCount,
      difficulty: difficulty as Difficulty,
    };

    console.log('[API] Generating quiz...', { contentLength: content.length, options });

    // AI로 퀴즈 생성 (멀티 모델 폴백)
    const result = await generateQuizWithFallback(content, options);

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
    });

    // 성공 응답
    return NextResponse.json({
      success: true,
      quiz: result.quiz,
      model: result.model,
      tokensUsed: result.tokensUsed,
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
