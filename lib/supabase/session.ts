// 퀴즈 세션 및 XP/스트릭 DB 서비스
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from './client';
import { logger } from '@/lib/utils/logger';
import type { UserAnswer } from '@/types';
import type { QuizSessionInsert, SessionAnswerInsert } from '@/types/supabase';

// 세션 완료 결과 타입
export interface SessionResult {
  sessionId: string;
  xpEarned: number;
  xpResult: {
    new_xp: number;
    new_level: number;
    level_up: boolean;
  } | null;
  streakResult: {
    new_streak: number;
    is_new_day: boolean;
  } | null;
}

// ============================================
// XP 계산
// ============================================

/**
 * XP 계산 함수
 * - 정답당 10XP
 * - 콤보 보너스: 최대 콤보 × 2
 * - 퍼펙트 보너스: 전문 정답 시 +20
 */
export function calculateXP(
  correctCount: number,
  totalQuestions: number,
  maxCombo: number
): number {
  const baseXP = correctCount * 10;
  const comboBonus = Math.floor(maxCombo * 2);
  const perfectBonus = correctCount === totalQuestions ? 20 : 0;

  return baseXP + comboBonus + perfectBonus;
}

// ============================================
// 세션 저장
// ============================================

/**
 * 퀴즈 세션 완료 및 저장
 * - quiz_sessions 테이블에 세션 저장
 * - session_answers 테이블에 답변 저장 (DB 퀴즈인 경우)
 * - add_xp RPC로 XP 추가 및 레벨 업데이트
 * - update_streak RPC로 스트릭 업데이트
 * - increment_profile_stats RPC로 통계 업데이트
 */
export async function completeQuizSession(
  userId: string,
  quizId: string | null, // null = localStorage 전용 퀴즈
  answers: UserAnswer[],
  maxCombo: number,
  questionIdMap?: Map<string, string> // 프론트 questionId -> DB questionId
): Promise<SessionResult> {
  const supabase = createClient() as any;

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const totalQuestions = answers.length;
  const score = Math.round((correctCount / totalQuestions) * 100);
  const xpEarned = calculateXP(correctCount, totalQuestions, maxCombo);

  // 1. 세션 생성
  const sessionData: QuizSessionInsert = {
    user_id: userId,
    quiz_id: quizId,
    score,
    correct_count: correctCount,
    total_questions: totalQuestions,
    max_combo: maxCombo,
    xp_earned: xpEarned,
    status: 'completed',
    completed_at: new Date().toISOString(),
  };

  const { data: session, error: sessionError } = await supabase
    .from('quiz_sessions')
    .insert(sessionData)
    .select()
    .single();

  if (sessionError || !session) {
    logger.error('Supabase', '세션 저장 실패', {
      error: sessionError?.message,
      code: sessionError?.code,
      details: sessionError?.details,
      userId,
      quizId,
    });
    return {
      sessionId: '',
      xpEarned,
      xpResult: null,
      streakResult: null,
    };
  }

  // 2. 답변 저장 (DB 퀴즈인 경우에만)
  if (quizId && questionIdMap && questionIdMap.size > 0) {
    const answersData: SessionAnswerInsert[] = answers
      .filter((a) => questionIdMap.get(a.questionId)) // null question_id 제외
      .map((a) => ({
        session_id: session.id,
        question_id: questionIdMap.get(a.questionId)!,
        user_answer: a.userAnswer,
        is_correct: a.isCorrect,
        time_spent_ms: a.timeSpentMs,
      }));

    if (answersData.length > 0) {
      const { error: answersError } = await supabase
        .from('session_answers')
        .insert(answersData);

      if (answersError) {
        logger.error('Supabase', '답변 저장 실패', {
          error: answersError.message,
          code: answersError.code,
          details: answersError.details,
          sessionId: session.id,
          answerCount: answersData.length,
        });
      }
    }
  }

  // 3. XP 추가
  let xpResult: SessionResult['xpResult'] = null;
  const { data: xpData, error: xpError } = await supabase.rpc('add_xp', {
    p_user_id: userId,
    xp_amount: xpEarned,
  });

  if (xpError) {
    logger.error('Supabase', 'XP 추가 RPC 실패', {
      error: xpError.message,
      code: xpError.code,
      userId,
      xpEarned,
    });
  } else if (xpData && xpData.length > 0) {
    xpResult = xpData[0];
    logger.debug('Supabase', 'XP 추가 성공', { xpResult });
  }

  // 4. 스트릭 업데이트
  let streakResult: SessionResult['streakResult'] = null;
  const { data: streakData, error: streakError } = await supabase.rpc(
    'update_streak',
    {
      p_user_id: userId,
    }
  );

  if (streakError) {
    logger.error('Supabase', '스트릭 업데이트 RPC 실패', {
      error: streakError.message,
      code: streakError.code,
      userId,
    });
  } else if (streakData && streakData.length > 0) {
    streakResult = streakData[0];
    logger.debug('Supabase', '스트릭 업데이트 성공', { streakResult });
  }

  // 5. 프로필 통계 업데이트
  const { error: statsError } = await supabase.rpc('increment_profile_stats', {
    p_user_id: userId,
    p_quizzes_played: 1,
    p_questions_answered: totalQuestions,
    p_correct_answers: correctCount,
  });

  if (statsError) {
    logger.error('Supabase', '프로필 통계 업데이트 RPC 실패', {
      error: statsError.message,
      code: statsError.code,
      userId,
      totalQuestions,
      correctCount,
    });
  }

  return {
    sessionId: session.id,
    xpEarned,
    xpResult,
    streakResult,
  };
}

// ============================================
// 세션 기록 조회
// ============================================

/**
 * 내 세션 기록 조회
 */
export async function getMySessionHistory(
  userId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    score: number;
    correct_count: number;
    total_questions: number;
    max_combo: number;
    xp_earned: number;
    completed_at: string | null;
    quiz_title: string | null;
  }>
> {
  const supabase = createClient() as any;

  const { data, error } = await supabase
    .from('quiz_sessions')
    .select(
      `
      id,
      score,
      correct_count,
      total_questions,
      max_combo,
      xp_earned,
      completed_at,
      quizzes:quiz_id (title)
    `
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Supabase', '세션 기록 조회 실패', {
      error: error.message,
      code: error.code,
      userId,
      limit,
    });
    return [];
  }
  if (!data) return [];

  return data.map((session: any) => ({
    id: session.id,
    score: session.score,
    correct_count: session.correct_count,
    total_questions: session.total_questions,
    max_combo: session.max_combo,
    xp_earned: session.xp_earned,
    completed_at: session.completed_at,
    quiz_title: session.quizzes?.title ?? null,
  }));
}
