import { useState, useRef, useCallback, useEffect } from 'react';
import { COMBO_THRESHOLDS } from '@/lib/constants';

interface UseQuizComboReturn {
  combo: number;
  maxCombo: number;
  showAnimation: boolean;
  incrementCombo: () => void;
  resetCombo: () => void;
  resetAll: () => void;
}

/**
 * 퀴즈 콤보 시스템 관리 훅
 * 연속 정답 시 콤보 증가, 오답 시 리셋
 */
export function useQuizCombo(): UseQuizComboReturn {
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [showAnimation, setShowAnimation] = useState(false);

  // 클로저 문제 해결을 위한 ref
  const maxComboRef = useRef(maxCombo);
  maxComboRef.current = maxCombo;

  // 애니메이션 타임아웃 ref (cleanup용)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 컴포넌트 언마운트 시 타임아웃 정리
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const incrementCombo = useCallback(() => {
    setCombo((prevCombo) => {
      const newCombo = prevCombo + 1;

      // 최대 콤보 업데이트
      if (newCombo > maxComboRef.current) {
        setMaxCombo(newCombo);
      }

      // 콤보 애니메이션 (2 이상일 때)
      if (newCombo >= COMBO_THRESHOLDS.MIN_DISPLAY) {
        setShowAnimation(true);

        // 기존 타임아웃 취소
        if (animationTimeoutRef.current) {
          clearTimeout(animationTimeoutRef.current);
        }

        animationTimeoutRef.current = setTimeout(() => {
          setShowAnimation(false);
        }, 1000);
      }

      return newCombo;
    });
  }, []);

  const resetCombo = useCallback(() => {
    setCombo(0);
  }, []);

  const resetAll = useCallback(() => {
    setCombo(0);
    setMaxCombo(0);
    setShowAnimation(false);
    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }
  }, []);

  return {
    combo,
    maxCombo,
    showAnimation,
    incrementCombo,
    resetCombo,
    resetAll,
  };
}
