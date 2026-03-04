import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { markAsOutdated } from '@/lib/supabase/wrongAnswers';
import { QuizJsonQuestionSchema } from '@/lib/utils/quizJson';
import { logger } from '@/lib/utils/logger';

const ReplaceBodySchema = z.object({
    title: z.string().min(1),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    questions: z.array(QuizJsonQuestionSchema).min(1).max(100),
});

/**
 * POST /api/quiz/[id]/replace
 *
 * 퀴즈 전체 교체 (기존 문제 삭제 후 새 문제 삽입)
 * bank_id, source_text, ai_model 클리어
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: quizId } = await params;
        const body = await request.json();

        // 0. 요청 body 검증
        const bodyResult = ReplaceBodySchema.safeParse(body);
        if (!bodyResult.success) {
            return NextResponse.json(
                { success: false, error: '입력이 올바르지 않습니다' },
                { status: 400 }
            );
        }
        const validatedBody = bodyResult.data;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        // 1. 인증 확인
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json(
                { success: false, error: '로그인이 필요합니다' },
                { status: 401 }
            );
        }

        // 2. 소유권 검증
        const { data: existingQuiz, error: quizError } = await supabase
            .from('saved_quizzes')
            .select('user_id')
            .eq('id', quizId)
            .single();

        if (quizError || !existingQuiz) {
            return NextResponse.json(
                { success: false, error: '퀴즈를 찾을 수 없습니다' },
                { status: 404 }
            );
        }

        if (existingQuiz.user_id !== user.id) {
            return NextResponse.json(
                { success: false, error: '수정 권한이 없습니다' },
                { status: 403 }
            );
        }

        logger.info('API', '퀴즈 전체 교체 시작', { quizId, userId: user.id });

        // 3. 기존 문제 ID 수집
        const { data: questionRows, error: selectError } = await supabase
            .from('saved_questions')
            .select('id')
            .eq('quiz_id', quizId);

        if (selectError) {
            logger.error('API', '기존 문제 조회 실패', { error: selectError.message, quizId });
            return NextResponse.json(
                { success: false, error: '기존 문제 조회에 실패했습니다' },
                { status: 500 }
            );
        }

        const existingIds = (questionRows ?? []).map((q: { id: string }) => q.id);

        // 4. wrong_answers is_outdated 처리 (삭제 전에 실행)
        if (existingIds.length > 0) {
            const { success: outdatedSuccess } = await markAsOutdated(existingIds);
            if (!outdatedSuccess) {
                return NextResponse.json(
                    { success: false, error: '오답노트 처리에 실패했습니다' },
                    { status: 500 }
                );
            }
        }

        // 5. 기존 문제 일괄 삭제
        const { error: deleteError } = await supabase
            .from('saved_questions')
            .delete()
            .eq('quiz_id', quizId);

        if (deleteError) {
            logger.error('API', '기존 문제 삭제 실패', { error: deleteError.message, quizId });
            return NextResponse.json(
                { success: false, error: '기존 문제 삭제에 실패했습니다' },
                { status: 500 }
            );
        }

        // 6. 새 문제 삽입 (order_index 0부터)
        const questionsData = validatedBody.questions.map((q, index) => ({
            quiz_id: quizId,
            type: q.type,
            question_text: q.questionText,
            options: q.options ?? null,
            correct_answers: q.correctAnswers,
            explanation: q.explanation ?? null,
            order_index: index,
        }));

        const { error: insertError } = await supabase
            .from('saved_questions')
            .insert(questionsData);

        if (insertError) {
            logger.error('API', '새 문제 삽입 실패', { error: insertError.message, quizId });
            return NextResponse.json(
                { success: false, error: '새 문제 저장에 실패했습니다' },
                { status: 500 }
            );
        }

        // 7. 퀴즈 메타데이터 업데이트
        const { error: updateError } = await supabase
            .from('saved_quizzes')
            .update({
                title: validatedBody.title,
                difficulty: validatedBody.difficulty ?? null,
                question_count: validatedBody.questions.length,
                source_text: null,
                bank_id: null,
                ai_model: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', quizId);

        if (updateError) {
            logger.error('API', '퀴즈 메타데이터 업데이트 실패', { error: updateError.message, quizId });
            return NextResponse.json(
                { success: false, error: '퀴즈 정보 업데이트에 실패했습니다' },
                { status: 500 }
            );
        }

        logger.info('API', '퀴즈 전체 교체 완료', { quizId, questionCount: validatedBody.questions.length });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('API', '퀴즈 교체 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { success: false, error: '교체 중 오류가 발생했습니다' },
            { status: 500 }
        );
    }
}
