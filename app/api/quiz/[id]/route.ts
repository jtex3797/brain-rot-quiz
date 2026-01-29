import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fromDbQuiz } from '@/lib/supabase/quiz';
import { logger } from '@/lib/utils/logger';
import type { DbSavedQuiz, DbSavedQuestion } from '@/types/supabase';
import type { QuizUpdateRequest, QuestionUpdate } from '@/types';

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

        // 플레이 중 수정을 위해 소유자 ID도 함께 반환
        return NextResponse.json({ quiz, ownerId: dbQuiz.user_id });
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

/**
 * PATCH /api/quiz/[id]
 *
 * 퀴즈 수정 (메타데이터 + 문제)
 * 개별 UPDATE 방식으로 문제 ID 유지
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: quizId } = await params;
        const body: QuizUpdateRequest = await request.json();

        if (!quizId) {
            return NextResponse.json(
                { success: false, error: '퀴즈 ID가 필요합니다' },
                { status: 400 }
            );
        }

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

        logger.info('API', '퀴즈 수정 시작', { quizId, userId: user.id });

        // 3. 퀴즈 메타데이터 업데이트
        if (body.title !== undefined || body.difficulty !== undefined) {
            const updateData: Record<string, unknown> = {
                updated_at: new Date().toISOString(),
            };
            if (body.title !== undefined) updateData.title = body.title;
            if (body.difficulty !== undefined) updateData.difficulty = body.difficulty;

            const { error: updateError } = await supabase
                .from('saved_quizzes')
                .update(updateData)
                .eq('id', quizId);

            if (updateError) {
                logger.error('API', '퀴즈 메타 수정 실패', { error: updateError.message });
                return NextResponse.json(
                    { success: false, error: '퀴즈 정보 수정에 실패했습니다' },
                    { status: 500 }
                );
            }
        }

        // 4. 문제 처리 (개별 UPDATE)
        if (body.questions && body.questions.length > 0) {
            const modifiedQuestionIds: string[] = [];

            for (let i = 0; i < body.questions.length; i++) {
                const q: QuestionUpdate = body.questions[i];

                if (q._delete && q.id) {
                    // 4-1. 삭제
                    const { error: deleteError } = await supabase
                        .from('saved_questions')
                        .delete()
                        .eq('id', q.id)
                        .eq('quiz_id', quizId);

                    if (deleteError) {
                        logger.error('API', '문제 삭제 실패', { questionId: q.id, error: deleteError.message });
                    }
                } else if (q.id) {
                    // 4-2. 기존 문제 수정
                    const { error: updateError } = await supabase
                        .from('saved_questions')
                        .update({
                            type: q.type,
                            question_text: q.questionText,
                            options: q.options ?? null,
                            correct_answers: q.correctAnswers,
                            explanation: q.explanation ?? null,
                            order_index: i,
                        })
                        .eq('id', q.id)
                        .eq('quiz_id', quizId);

                    if (updateError) {
                        logger.error('API', '문제 수정 실패', { questionId: q.id, error: updateError.message });
                    } else {
                        modifiedQuestionIds.push(q.id);
                    }
                } else {
                    // 4-3. 새 문제 추가
                    const { error: insertError } = await supabase
                        .from('saved_questions')
                        .insert({
                            quiz_id: quizId,
                            type: q.type,
                            question_text: q.questionText,
                            options: q.options ?? null,
                            correct_answers: q.correctAnswers,
                            explanation: q.explanation ?? null,
                            order_index: i,
                        });

                    if (insertError) {
                        logger.error('API', '문제 추가 실패', { error: insertError.message });
                    }
                }
            }

            // 5. 수정된 문제의 오답노트 outdated 처리
            if (modifiedQuestionIds.length > 0) {
                await supabase
                    .from('wrong_answers')
                    .update({ is_outdated: true })
                    .in('question_id', modifiedQuestionIds);
            }

            // 6. question_count 업데이트
            const activeQuestions = body.questions.filter(q => !q._delete);
            await supabase
                .from('saved_quizzes')
                .update({
                    question_count: activeQuestions.length,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', quizId);
        }

        logger.info('API', '퀴즈 수정 완료', { quizId });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error('API', '퀴즈 수정 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return NextResponse.json(
            { success: false, error: '퀴즈 수정에 실패했습니다' },
            { status: 500 }
        );
    }
}
