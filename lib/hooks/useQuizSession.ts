// 퀴즈 세션 DB 연동 훅

'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  completeQuizSession,
  calculateXP,
  type SessionResult,
} from '@/lib/supabase/session';
import type { UserAnswer, Question } from '@/types';

interface UseQuizSessionReturn {
  isSubmitting: boolean;
  sessionResult: SessionResult | null;
  submitSession: (
    quizId: string | null,
    answers: UserAnswer[],
    maxCombo: number,
    questionIdMap?: Map<string, string>,
    quizTitle?: string,
    questions?: Question[]
  ) => Promise<SessionResult | null>;
  calculatePreviewXP: (
    correctCount: number,
    totalQuestions: number,
    maxCombo: number
  ) => number;
  resetSession: () => void;
}

export function useQuizSession(): UseQuizSessionReturn {
  const { user, refreshProfile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionResult, setSessionResult] = useState<SessionResult | null>(
    null
  );

  const submitSession = useCallback(
    async (
      quizId: string | null,
      answers: UserAnswer[],
      maxCombo: number,
      questionIdMap?: Map<string, string>,
      quizTitle?: string,
      questions?: Question[]
    ): Promise<SessionResult | null> => {
      // 비로그인 시 저장 안 함
      if (!user) {
        return null;
      }

      setIsSubmitting(true);

      try {
        const result = await completeQuizSession(
          user.id,
          quizId,
          answers,
          maxCombo,
          questionIdMap,
          quizTitle,
          questions
        );
        setSessionResult(result);

        // AuthContext의 프로필 갱신 (XP, 레벨 등 반영)
        await refreshProfile();

        return result;
      } catch (error) {
        console.error('세션 저장 실패:', error);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [user, refreshProfile]
  );

  const resetSession = useCallback(() => {
    setSessionResult(null);
    setIsSubmitting(false);
  }, []);

  return {
    isSubmitting,
    sessionResult,
    submitSession,
    calculatePreviewXP: calculateXP,
    resetSession,
  };
}
