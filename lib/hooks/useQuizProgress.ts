import { useState, useCallback, useMemo } from 'react';

interface UseQuizProgressReturn {
  currentIndex: number;
  isComplete: boolean;
  progress: number;
  moveToNext: () => void;
  reset: () => void;
}

/**
 * 퀴즈 진행 상태 관리 훅
 * 현재 문제 인덱스, 완료 여부, 진행률 관리
 */
export function useQuizProgress(totalQuestions: number): UseQuizProgressReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // 진행률 계산 (0-100)
  const progress = useMemo(() => {
    if (totalQuestions === 0) return 0;
    return Math.round(((currentIndex + 1) / totalQuestions) * 100);
  }, [currentIndex, totalQuestions]);

  const moveToNext = useCallback(() => {
    setCurrentIndex((prevIndex) => {
      if (prevIndex < totalQuestions - 1) {
        return prevIndex + 1;
      } else {
        setIsComplete(true);
        return prevIndex;
      }
    });
  }, [totalQuestions]);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setIsComplete(false);
  }, []);

  return {
    currentIndex,
    isComplete,
    progress,
    moveToNext,
    reset,
  };
}
