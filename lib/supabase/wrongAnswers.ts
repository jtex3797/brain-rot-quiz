import { createClient } from './server';
import { logger } from '@/lib/utils/logger';
import type { Question, QuizType } from '@/types';

/**
 * 오답 스냅샷 타입
 */
interface QuestionSnapshot {
    type: string;
    questionText: string;
    options?: string[];
    correctAnswers: string[];
    explanation?: string;
}

/**
 * 오답 저장 파라미터
 */
interface SaveWrongAnswerParams {
    userId: string;
    quizId: string;
    quizTitle: string;
    question: Question;
    userAnswer: string;
}

/**
 * 오답노트 항목 타입
 */
export interface WrongAnswerItem {
    id: string;
    quizId: string | null;
    questionId: string | null;
    quizTitle: string;
    questionSnapshot: QuestionSnapshot;
    userAnswer: string;
    wrongCount: number;
    isOutdated: boolean;
    isResolved: boolean;
    firstWrongAt: Date;
    lastWrongAt: Date;
    resolvedAt: Date | null;
}

/**
 * 오답 저장 (UPSERT)
 * - 이미 같은 문제가 있으면 wrong_count 증가, last_wrong_at 업데이트
 * - 없으면 새로 생성
 */
export async function saveWrongAnswer({
    userId,
    quizId,
    quizTitle,
    question,
    userAnswer,
}: SaveWrongAnswerParams): Promise<{ success: boolean; error?: string }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        const snapshot: QuestionSnapshot = {
            type: question.type,
            questionText: question.questionText,
            options: question.options,
            correctAnswers: question.correctAnswers,
            explanation: question.explanation,
        };

        // UPSERT: user_id + question_id 조합이 유니크
        const { error } = await supabase
            .from('wrong_answers')
            .upsert(
                {
                    user_id: userId,
                    quiz_id: quizId,
                    question_id: question.id,
                    quiz_title: quizTitle,
                    question_snapshot: snapshot,
                    user_answer: userAnswer,
                    wrong_count: 1,
                    is_outdated: false,
                    is_resolved: false,
                    last_wrong_at: new Date().toISOString(),
                },
                {
                    onConflict: 'user_id,question_id',
                    ignoreDuplicates: false,
                }
            )
            .select();

        // UPSERT가 기존 레코드를 찾으면 wrong_count 증가
        if (!error) {
            await supabase.rpc('increment_wrong_count', {
                p_user_id: userId,
                p_question_id: question.id,
            }).catch(() => {
                // RPC가 없으면 수동 업데이트
                return supabase
                    .from('wrong_answers')
                    .update({
                        wrong_count: supabase.raw('wrong_count + 1'),
                        last_wrong_at: new Date().toISOString(),
                        is_resolved: false, // 다시 틀리면 resolved 해제
                        resolved_at: null,
                    })
                    .eq('user_id', userId)
                    .eq('question_id', question.id);
            });
        }

        if (error) {
            logger.error('WrongAnswers', '오답 저장 실패', { error: error.message });
            return { success: false, error: error.message };
        }

        logger.info('WrongAnswers', '오답 저장 완료', {
            userId,
            questionId: question.id,
        });

        return { success: true };
    } catch (error) {
        logger.error('WrongAnswers', '오답 저장 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return { success: false, error: '오답 저장에 실패했습니다' };
    }
}

/**
 * 사용자의 오답 목록 조회
 */
export async function getWrongAnswers(
    userId: string,
    options?: {
        includeResolved?: boolean;
        includeOutdated?: boolean;
        limit?: number;
    }
): Promise<WrongAnswerItem[]> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        let query = supabase
            .from('wrong_answers')
            .select('*')
            .eq('user_id', userId)
            .order('last_wrong_at', { ascending: false });

        if (!options?.includeResolved) {
            query = query.eq('is_resolved', false);
        }

        if (!options?.includeOutdated) {
            query = query.eq('is_outdated', false);
        }

        if (options?.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;

        if (error) {
            logger.error('WrongAnswers', '오답 목록 조회 실패', { error: error.message });
            return [];
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (data || []).map((item: any) => ({
            id: item.id,
            quizId: item.quiz_id,
            questionId: item.question_id,
            quizTitle: item.quiz_title,
            questionSnapshot: item.question_snapshot,
            userAnswer: item.user_answer,
            wrongCount: item.wrong_count,
            isOutdated: item.is_outdated,
            isResolved: item.is_resolved,
            firstWrongAt: new Date(item.first_wrong_at),
            lastWrongAt: new Date(item.last_wrong_at),
            resolvedAt: item.resolved_at ? new Date(item.resolved_at) : null,
        }));
    } catch (error) {
        logger.error('WrongAnswers', '오답 목록 조회 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return [];
    }
}

/**
 * 오답을 정답으로 맞춘 경우 resolved 처리
 */
export async function markAsResolved(
    userId: string,
    questionId: string
): Promise<{ success: boolean }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        const { error } = await supabase
            .from('wrong_answers')
            .update({
                is_resolved: true,
                resolved_at: new Date().toISOString(),
            })
            .eq('user_id', userId)
            .eq('question_id', questionId);

        if (error) {
            logger.error('WrongAnswers', 'resolved 처리 실패', { error: error.message });
            return { success: false };
        }

        logger.info('WrongAnswers', '오답 resolved 처리 완료', { userId, questionId });
        return { success: true };
    } catch (error) {
        logger.error('WrongAnswers', 'resolved 처리 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return { success: false };
    }
}

/**
 * 원본 문제 수정 시 outdated 처리 (API에서 호출)
 */
export async function markAsOutdated(
    questionIds: string[]
): Promise<{ success: boolean }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        const { error } = await supabase
            .from('wrong_answers')
            .update({ is_outdated: true })
            .in('question_id', questionIds);

        if (error) {
            logger.error('WrongAnswers', 'outdated 처리 실패', { error: error.message });
            return { success: false };
        }

        logger.info('WrongAnswers', '오답 outdated 처리 완료', { count: questionIds.length });
        return { success: true };
    } catch (error) {
        logger.error('WrongAnswers', 'outdated 처리 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return { success: false };
    }
}

/**
 * 특정 오답 삭제
 */
export async function deleteWrongAnswer(
    userId: string,
    wrongAnswerId: string
): Promise<{ success: boolean }> {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const supabase = await createClient() as any;

        const { error } = await supabase
            .from('wrong_answers')
            .delete()
            .eq('id', wrongAnswerId)
            .eq('user_id', userId);

        if (error) {
            logger.error('WrongAnswers', '오답 삭제 실패', { error: error.message });
            return { success: false };
        }

        return { success: true };
    } catch (error) {
        logger.error('WrongAnswers', '오답 삭제 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return { success: false };
    }
}

/**
 * 오답 복습용 결과 타입
 */
export interface WrongAnswersQuizResult {
    questions: Question[];
    questionIdMap: Record<string, string>; // frontendId -> dbQuestionId
}

/**
 * 오답을 Question[] 형식으로 변환하여 반환 (오답 복습용)
 * questionIdMap도 함께 반환하여 resolved 처리에 활용
 */
export async function getWrongAnswersAsQuestions(
    userId: string,
    options?: {
        quizId?: string;
        limit?: number;
    }
): Promise<WrongAnswersQuizResult> {
    try {
        const wrongAnswers = await getWrongAnswers(userId, {
            includeResolved: false,
            includeOutdated: false,
            limit: options?.limit,
        });

        // 퀴즈별 필터링
        const filtered = options?.quizId
            ? wrongAnswers.filter((wa) => wa.quizId === options.quizId)
            : wrongAnswers;

        const questionIdMap: Record<string, string> = {};

        // QuestionSnapshot → Question 변환
        const questions = filtered.map((wa) => {
            const frontendId = wa.questionId || `wrong-${wa.id}`;
            // DB questionId가 있으면 매핑 저장 (resolved 처리용)
            if (wa.questionId) {
                questionIdMap[frontendId] = wa.questionId;
            }
            return {
                id: frontendId,
                type: wa.questionSnapshot.type as QuizType,
                questionText: wa.questionSnapshot.questionText,
                options: wa.questionSnapshot.options,
                correctAnswers: wa.questionSnapshot.correctAnswers,
                explanation: wa.questionSnapshot.explanation,
            };
        });

        return { questions, questionIdMap };
    } catch (error) {
        logger.error('WrongAnswers', '오답→Question 변환 중 예외', {
            error: error instanceof Error ? error.message : String(error),
        });
        return { questions: [], questionIdMap: {} };
    }
}
