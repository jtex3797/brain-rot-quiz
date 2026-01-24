import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const next = searchParams.get('next') ?? '/';

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            logger.error('Supabase', 'OAuth 콜백 세션 교환 실패', {
                error: error.message,
                code: error.code,
                status: error.status,
            });
        } else {
            logger.info('Supabase', 'OAuth 콜백 성공', { next });
            return NextResponse.redirect(`${origin}${next}`);
        }
    } else {
        logger.warn('Supabase', 'OAuth 콜백 code 파라미터 없음');
    }

    // 에러 발생 시 로그인 페이지로 리다이렉트
    return NextResponse.redirect(`${origin}/auth/login?error=callback_error`);
}
