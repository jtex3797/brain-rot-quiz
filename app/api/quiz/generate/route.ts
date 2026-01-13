import { NextRequest, NextResponse } from 'next/server';
import { generateQuizWithFallback, validateQuiz } from '@/lib/ai/generate';
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
        { error: '텍스트 내용이 필요합니다' },
        { status: 400 }
      );
    }

    if (content.trim().length < 50) {
      return NextResponse.json(
        { error: '텍스트가 너무 짧습니다. 최소 50자 이상 입력해주세요.' },
        { status: 400 }
      );
    }

    if (questionCount < 1 || questionCount > 20) {
      return NextResponse.json(
        { error: '문제 수는 1개에서 20개 사이여야 합니다' },
        { status: 400 }
      );
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return NextResponse.json(
        { error: '유효하지 않은 난이도입니다' },
        { status: 400 }
      );
    }

    // 퀴즈 생성 옵션
    const options: QuizGenerationOptions = {
      questionCount,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
    };

    console.log('[API] Generating quiz...', { contentLength: content.length, options });

    // AI로 퀴즈 생성 (멀티 모델 폴백)
    const result = await generateQuizWithFallback(content, options);

    // 퀴즈 유효성 검증
    const validation = validateQuiz(result.quiz);
    if (!validation.valid) {
      console.error('[API] Invalid quiz generated:', validation.errors);
      return NextResponse.json(
        { error: '퀴즈 생성 중 오류가 발생했습니다', details: validation.errors },
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
  } catch (error: any) {
    console.error('[API] Error generating quiz:', error);

    // 사용자 친화적인 에러 메시지
    const errorMessage = error.message || '퀴즈 생성 중 오류가 발생했습니다';

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
    supportedDifficulties: ['easy', 'medium', 'hard'],
    questionCountRange: { min: 1, max: 20 },
  });
}
