import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { DbSavedQuiz } from '@/types/supabase';

/**
 * GET /api/my-quizzes
 *
 * 내 퀴즈 목록 조회 (서버 사이드)
 * RLS + 서버 인증으로 안정적인 데이터 조회
 */
export async function GET() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        // getUser()로 인증 확인 (getSession 보안 경고 해결)
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { quizzes: [], error: '로그인이 필요합니다' },
                { status: 401 }
            );
        }

        // 퀴즈 목록 조회
        const { data: quizzes, error: queryError } = await supabase
            .from('saved_quizzes')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (queryError) {
            logger.error('API', '퀴즈 목록 조회 실패', {
                error: queryError.message,
                code: queryError.code,
                userId: user.id,
            });
            return NextResponse.json(
                { quizzes: [], error: queryError.message },
                { status: 500 }
            );
        }

        const quizList = (quizzes ?? []) as DbSavedQuiz[];

        // bank_id가 있는 퀴즈의 고유 bank_id 목록
        const bankIds = [...new Set(
            quizList.filter((q) => q.bank_id).map((q) => q.bank_id as string)
        )];

        let bankCounts: Record<string, number> = {};

        if (bankIds.length > 0) {
            const { data: items } = await supabase
                .from('question_bank_items')
                .select('bank_id')
                .in('bank_id', bankIds);

            if (items) {
                bankCounts = (items as Array<{ bank_id: string }>).reduce<Record<string, number>>((acc, item) => {
                    acc[item.bank_id] = (acc[item.bank_id] ?? 0) + 1;
                    return acc;
                }, {});
            }
        }

        // 각 퀴즈에 bank_question_count 병합
        const enrichedQuizzes = quizList.map((q) => ({
            ...q,
            bank_question_count: q.bank_id ? (bankCounts[q.bank_id] ?? null) : null,
        }));

        return NextResponse.json({ quizzes: enrichedQuizzes });
    } catch (error) {
        logger.error('API', '퀴즈 목록 조회 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { quizzes: [], error: '퀴즈 목록을 불러오는데 실패했습니다' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/my-quizzes?id={quizId}
 *
 * 퀴즈 삭제
 */
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const quizId = searchParams.get('id');

        if (!quizId) {
            return NextResponse.json(
                { success: false, error: '퀴즈 ID가 필요합니다' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: '로그인이 필요합니다' },
                { status: 401 }
            );
        }

        const { error: deleteError } = await supabase
            .from('saved_quizzes')
            .delete()
            .eq('id', quizId)
            .eq('user_id', user.id);

        if (deleteError) {
            return NextResponse.json(
                { success: false, error: deleteError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('API', '퀴즈 삭제 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { success: false, error: '퀴즈 삭제에 실패했습니다' },
            { status: 500 }
        );
    }
}
