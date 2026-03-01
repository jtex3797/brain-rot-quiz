import { useEffect } from 'react';
import type { MatchResult } from '@/lib/quiz/answerMatcher';

interface QuizKeyboardOptions {
  showResult: boolean;
  autoNext: boolean;
  showEditModal: boolean;
  options?: string[];
  selectedAnswer: string | null;
  matchResult: MatchResult | null;
  onSelectOption: (option: string) => void;
  onAnswer: (answer: string, isCorrect: boolean, matchResult: MatchResult) => void;
}

/**
 * 퀴즈 키보드 단축키 중앙 관리 훅
 *
 * 답변 전:  1/2/3/4 → 객관식/OX 선택지 선택
 * 결과 후:  Enter   → 다음 문제 (수동 모드 한정)
 *
 * 단축키 추가/변경 시 이 파일만 수정하면 됨.
 */
export function useQuizKeyboard(opts: QuizKeyboardOptions) {
  const {
    showResult, autoNext, showEditModal,
    options, selectedAnswer, matchResult,
    onSelectOption, onAnswer,
  } = opts;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 텍스트 입력 중이면 모든 단축키 무시 (단답형 입력 필드)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      if (!showResult) {
        // ─── 답변 전: 1/2/3/4로 선택지 선택 ───
        if (options && options.length > 0) {
          const index = parseInt(e.key, 10) - 1;
          if (!isNaN(index) && index >= 0 && index < options.length) {
            e.preventDefault();
            onSelectOption(options[index]);
          }
        }
      } else {
        // ─── 결과 공개 후: Enter로 다음 문제 ───
        if (
          e.key === 'Enter' &&
          !autoNext &&
          !showEditModal &&
          selectedAnswer &&
          matchResult
        ) {
          onAnswer(selectedAnswer, matchResult.isCorrect, matchResult);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    showResult, autoNext, showEditModal,
    options, selectedAnswer, matchResult,
    onSelectOption, onAnswer,
  ]);
}
