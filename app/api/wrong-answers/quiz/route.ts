import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getWrongAnswersAsQuestions } from '@/lib/supabase/wrongAnswers';

/**
 * GET /api/wrong-answers/quiz
 * 오답을 Question[] 형식으로 반환 (오답 복습용)
 *
 * Query params:
 * - quizId: 특정 퀴즈의 오답만 반환 (선택)
 * - limit: 최대 문제 수 (선택)
 *
 * Response:
 * - questions: Question[]
 * - questionIdMap: Record<string, string> - 프론트엔드 ID → DB questionId 매핑
 * - count: number
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: '로그인이 필요합니다' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const quizId = searchParams.get('quizId') || undefined;
        const limitStr = searchParams.get('limit');
        const limit = limitStr ? parseInt(limitStr, 10) : undefined;

        const { questions, questionIdMap } = await getWrongAnswersAsQuestions(user.id, {
            quizId,
            limit,
        });

        return NextResponse.json({
            success: true,
            questions,
            questionIdMap,
            count: questions.length,
        });
    } catch (error) {
        console.error('오답 퀴즈 조회 실패:', error);
        return NextResponse.json(
            { error: '오답 퀴즈 조회에 실패했습니다' },
            { status: 500 }
        );
    }
}
