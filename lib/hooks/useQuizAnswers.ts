import { useState, useCallback, useMemo } from 'react';
import type { UserAnswer } from '@/types';

interface UseQuizAnswersReturn {
  answers: UserAnswer[];
  correctCount: number;
  wrongAnswers: UserAnswer[];
  recordAnswer: (
    questionId: string,
    answer: string,
    isCorrect: boolean,
    matchType?: 'exact' | 'similar' | 'wrong',
    similarity?: number
  ) => void;
  reset: () => void;
}

/**
 * 퀴즈 답변 기록 관리 훅
 * 사용자 답변 저장 및 정답/오답 집계
 */
export function useQuizAnswers(): UseQuizAnswersReturn {
  const [answers, setAnswers] = useState<UserAnswer[]>([]);

  // 정답 수 계산
  const correctCount = useMemo(() => {
    return answers.filter((a) => a.isCorrect).length;
  }, [answers]);

  // 오답 목록
  const wrongAnswers = useMemo(() => {
    return answers.filter((a) => !a.isCorrect);
  }, [answers]);

  const recordAnswer = useCallback(
    (
      questionId: string,
      answer: string,
      isCorrect: boolean,
      matchType?: 'exact' | 'similar' | 'wrong',
      similarity?: number
    ) => {
      const userAnswer: UserAnswer = {
        questionId,
        userAnswer: answer,
        isCorrect,
        timeSpentMs: 0,
        matchType,
        similarity,
      };
      setAnswers((prev) => [...prev, userAnswer]);
    },
    []
  );

  const reset = useCallback(() => {
    setAnswers([]);
  }, []);

  return {
    answers,
    correctCount,
    wrongAnswers,
    recordAnswer,
    reset,
  };
}
