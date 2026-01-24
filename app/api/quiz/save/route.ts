import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { Question } from '@/types';

/**
 * POST /api/quiz/save
 *
 * 퀴즈를 DB에 저장 (서버 사이드)
 * RLS 정책이 적용되어 로그인한 사용자만 저장 가능
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { quiz, sourceText, difficulty } = body;

        // 입력 검증
        if (!quiz || !quiz.id || !quiz.questions) {
            return NextResponse.json(
                { success: false, error: '유효하지 않은 퀴즈 데이터입니다' },
                { status: 400 }
            );
        }

        // 서버 사이드 Supabase 클라이언트 (auth.uid() 정상 작동)
        const supabase = await createClient();

        // 로그인 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: '로그인이 필요합니다' },
                { status: 401 }
            );
        }

        logger.info('API', '📥 퀴즈 저장 요청', {
            quizId: quiz.id,
            userId: user.id,
            questionCount: quiz.questions.length,
        });

        // 6자리 공유 코드 생성
        const shareCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        // 1. 퀴즈 메타데이터 저장
        const { error: quizError } = await (supabase as any)
            .from('quizzes')
            .insert({
                id: quiz.id,
                user_id: user.id,
                title: quiz.title || '생성된 퀴즈',
                source_text: sourceText ?? null,
                difficulty: difficulty ?? null,
                question_count: quiz.questions.length,
                is_public: false,
                share_code: shareCode,
                pool_id: quiz.poolId ?? null,
            });

        if (quizError) {
            logger.error('API', '퀴즈 저장 실패', { error: quizError.message });
            return NextResponse.json(
                { success: false, error: quizError.message },
                { status: 500 }
            );
        }

        // 2. 문제들 저장
        const questionsData = quiz.questions.map((q: Question, index: number) => ({
            quiz_id: quiz.id,
            type: q.type,
            question_text: q.questionText,
            options: q.options ?? null,
            correct_answer: q.correctAnswer,
            explanation: q.explanation ?? null,
            order_index: index,
        }));

        const { error: questionsError } = await (supabase as any)
            .from('questions')
            .insert(questionsData);

        if (questionsError) {
            logger.error('API', '문제 저장 실패', { error: questionsError.message });
            // 롤백: 퀴즈 삭제
            await (supabase as any).from('quizzes').delete().eq('id', quiz.id);
            return NextResponse.json(
                { success: false, error: questionsError.message },
                { status: 500 }
            );
        }

        logger.info('API', '✅ 퀴즈 저장 완료', {
            quizId: quiz.id,
            shareCode,
        });

        return NextResponse.json({
            success: true,
            quizId: quiz.id,
            shareCode,
        });
    } catch (error) {
        logger.error('API', '퀴즈 저장 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });

        return NextResponse.json(
            { success: false, error: '퀴즈 저장에 실패했습니다' },
            { status: 500 }
        );
    }
}
