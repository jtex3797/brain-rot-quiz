import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fromDbQuiz } from '@/lib/supabase/quiz';
import { logger } from '@/lib/utils/logger';
import type { DbSavedQuiz, DbSavedQuestion } from '@/types/supabase';

/**
 * GET /api/quiz/[id]
 *
 * 퀴즈 상세 조회 (서버 사이드)
 * RLS + 서버 인증으로 안정적인 데이터 조회
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: quizId } = await params;

        if (!quizId) {
            return NextResponse.json(
                { quiz: null, error: '퀴즈 ID가 필요합니다' },
                { status: 400 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        // 퀴즈 메타데이터 조회
        const { data: dbQuiz, error: quizError } = await supabase
            .from('saved_quizzes')
            .select('*')
            .eq('id', quizId)
            .maybeSingle();

        if (quizError) {
            logger.error('API', '퀴즈 조회 실패', {
                error: quizError.message,
                code: quizError.code,
                quizId,
            });
            return NextResponse.json(
                { quiz: null, error: quizError.message },
                { status: 500 }
            );
        }

        if (!dbQuiz) {
            return NextResponse.json(
                { quiz: null, error: '퀴즈를 찾을 수 없습니다' },
                { status: 404 }
            );
        }

        // 문제 조회
        const { data: dbQuestions, error: questionsError } = await supabase
            .from('saved_questions')
            .select('*')
            .eq('quiz_id', dbQuiz.id)
            .order('order_index');

        if (questionsError) {
            logger.error('API', '퀴즈 문제 조회 실패', {
                error: questionsError.message,
                code: questionsError.code,
                quizId,
            });
            return NextResponse.json(
                { quiz: null, error: questionsError.message },
                { status: 500 }
            );
        }

        if (!dbQuestions) {
            return NextResponse.json(
                { quiz: null, error: '문제를 찾을 수 없습니다' },
                { status: 404 }
            );
        }

        const quiz = fromDbQuiz(
            dbQuiz as DbSavedQuiz,
            dbQuestions as DbSavedQuestion[]
        );

        // bank_id가 있으면 남은 문제 수 조회
        if (dbQuiz.bank_id) {
            const { count } = await supabase
                .from('question_bank_items')
                .select('*', { count: 'exact', head: true })
                .eq('bank_id', dbQuiz.bank_id);

            quiz.remainingCount = Math.max(0, (count ?? 0) - quiz.questions.length);
        }

        return NextResponse.json({ quiz });
    } catch (error) {
        logger.error('API', '퀴즈 조회 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { quiz: null, error: '퀴즈를 불러오는데 실패했습니다' },
            { status: 500 }
        );
    }
}
