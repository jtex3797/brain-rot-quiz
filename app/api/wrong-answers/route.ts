import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/wrong-answers
 * 사용자의 오답노트 목록 조회
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const includeResolved = searchParams.get('includeResolved') === 'true';
        const includeOutdated = searchParams.get('includeOutdated') === 'true';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        // 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { wrongAnswers: [], error: '로그인이 필요합니다' },
                { status: 401 }
            );
        }

        // 오답 목록 조회
        let query = supabase
            .from('wrong_answers')
            .select('*')
            .eq('user_id', user.id)
            .order('last_wrong_at', { ascending: false });

        if (!includeResolved) {
            query = query.eq('is_resolved', false);
        }

        if (!includeOutdated) {
            query = query.eq('is_outdated', false);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('API', '오답노트 조회 실패', { error: error.message });
            return NextResponse.json(
                { wrongAnswers: [], error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ wrongAnswers: data ?? [] });
    } catch (error) {
        logger.error('API', '오답노트 조회 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { wrongAnswers: [], error: '오답노트를 불러오는데 실패했습니다' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/wrong-answers?id=xxx
 * 특정 오답 삭제
 */
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const wrongAnswerId = searchParams.get('id');

        if (!wrongAnswerId) {
            return NextResponse.json(
                { success: false, error: 'ID가 필요합니다' },
                { status: 400 }
            );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        // 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: '로그인이 필요합니다' },
                { status: 401 }
            );
        }

        // 삭제 (RLS로 본인 것만 삭제 가능)
        const { error } = await supabase
            .from('wrong_answers')
            .delete()
            .eq('id', wrongAnswerId)
            .eq('user_id', user.id);

        if (error) {
            logger.error('API', '오답 삭제 실패', { error: error.message });
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('API', '오답 삭제 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { success: false, error: '오답 삭제에 실패했습니다' },
            { status: 500 }
        );
    }
}
