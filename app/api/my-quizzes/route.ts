import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/my-quizzes
 *
 * 내 퀴즈 목록 조회 (서버 사이드)
 * RLS + 서버 인증으로 안정적인 데이터 조회
 */
export async function GET() {
    try {
        const supabase = await createClient();

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

        return NextResponse.json({ quizzes: quizzes ?? [] });
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
