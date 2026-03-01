'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { OptionButton, OptionState } from './OptionButton';
import { EditQuestionModal } from './EditQuestionModal';
import { useQuizSound, useQuizKeyboard } from '@/lib/hooks';
import { useDisplayPrefs } from '@/contexts/DisplayPrefsContext';
import { checkAnswer, type MatchResult } from '@/lib/quiz/answerMatcher';
import type { Question } from '@/types';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: string, isCorrect: boolean, matchResult?: MatchResult) => void;
  disabled: boolean;
  autoNext: boolean;
  // 플레이 중 수정 관련
  canEdit?: boolean;
  quizId?: string;
  onQuestionUpdate?: (updated: Question) => void;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled,
  autoNext,
  canEdit = false,
  quizId,
  onQuestionUpdate,
}: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [shortAnswer, setShortAnswer] = useState('');
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { playCorrect, playWrong } = useQuizSound();
  const { explanationFontSize } = useDisplayPrefs();

  // 편집 모달 열기 (자동 넘김 타이머 중지)
  const handleOpenEdit = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setShowEditModal(true);
  };

  // 편집 완료 후 처리
  const handleQuestionSave = (updated: Question) => {
    setShowEditModal(false);
    if (onQuestionUpdate) {
      onQuestionUpdate(updated);
    }
  };

  // 편집 취소 시 처리 (autoNext 타이머 복구)
  const handleCloseEdit = () => {
    setShowEditModal(false);
    if (autoNext && matchResult && selectedAnswer && !timeoutRef.current) {
      timeoutRef.current = setTimeout(() => {
        onAnswer(selectedAnswer, matchResult.isCorrect, matchResult);
      }, 1500);
    }
  };

  const handleOptionClick = (option: string) => {
    if (disabled || showResult) return;

    setSelectedAnswer(option);
    setShowResult(true);

    const result = checkAnswer(option, question.correctAnswers, question.type);
    setMatchResult(result);

    // 사운드 재생
    if (result.isCorrect) {
      playCorrect();
    } else {
      playWrong();
    }

    // 자동 넘김 모드일 때만 1.5초 후 다음 문제로
    if (autoNext) {
      timeoutRef.current = setTimeout(() => {
        onAnswer(option, result.isCorrect, result);
      }, 1500);
    }
  };

  const handleShortAnswerSubmit = () => {
    if (disabled || showResult || !shortAnswer.trim()) return;

    setSelectedAnswer(shortAnswer.trim());
    setShowResult(true);

    const result = checkAnswer(shortAnswer.trim(), question.correctAnswers, question.type);
    setMatchResult(result);

    // 사운드 재생
    if (result.isCorrect) {
      playCorrect();
    } else {
      playWrong();
    }

    // 자동 넘김 모드일 때만 1.5초 후 다음 문제로
    if (autoNext) {
      timeoutRef.current = setTimeout(() => {
        onAnswer(shortAnswer.trim(), result.isCorrect, result);
      }, 1500);
    }
  };

  // 컴포넌트 언마운트 시 타이머 정리
  // 참고: 문제가 바뀔 때 상태는 key prop으로 컴포넌트가 새로 마운트되어 자동 초기화됨
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 키보드 단축키 (1/2/3/4: 선택지 선택, Enter: 다음 문제)
  useQuizKeyboard({
    showResult,
    autoNext,
    showEditModal,
    options: question.options,
    selectedAnswer,
    matchResult,
    onSelectOption: handleOptionClick,
    onAnswer,
  });

  // autoNext 토글 시 showResult 상태와 동기화
  useEffect(() => {
    if (!showResult || !matchResult || !selectedAnswer) return;

    if (autoNext) {
      // 수동 → 자동: 타이머 없으면 새로 설정
      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          onAnswer(selectedAnswer, matchResult.isCorrect, matchResult);
        }, 1500);
      }
    } else {
      // 자동 → 수동: 실행 중인 타이머 취소
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [autoNext]); // eslint-disable-line react-hooks/exhaustive-deps

  const getOptionState = (option: string): OptionState => {
    if (!showResult) {
      return selectedAnswer === option ? 'selected' : 'default';
    }

    if (question.correctAnswers.includes(option)) {
      return selectedAnswer === option ? 'correct' : 'reveal';
    }

    if (selectedAnswer === option) {
      return 'wrong';
    }

    return 'default';
  };

  const isCorrectAnswer = matchResult?.isCorrect ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3 }}
      className="w-full max-w-2xl mx-auto"
    >
      {/* 문제 번호 */}
      <div className="mb-4 text-center">
        <span className="text-foreground/60">
          문제 {questionNumber} / {totalQuestions}
        </span>
      </div>

      {/* 문제 카드 */}
      <div className="bg-foreground/5 rounded-2xl p-6 mb-6">
        {/* 문제 유형 태그 */}
        <div className="mb-4">
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {question.type === 'mcq' ? '객관식' : question.type === 'ox' ? 'O/X' : '단답형'}
          </span>
        </div>

        {/* 문제 텍스트 */}
        <h2 className="text-xl font-medium text-foreground leading-relaxed">
          {question.questionText}
        </h2>
      </div>

      {/* 선택지 (객관식/OX) */}
      {question.options && question.options.length > 0 && (
        <div className="space-y-3">
          {question.options.map((option, index) => (
            <OptionButton
              key={index}
              option={option}
              index={index}
              state={getOptionState(option)}
              disabled={disabled || showResult}
              onClick={() => handleOptionClick(option)}
            />
          ))}
        </div>
      )}

      {/* 단답형 입력 */}
      {(question.type === 'short' || question.type === 'fill') && !question.options?.length && (
        <div className="space-y-3">
          <input
            type="text"
            value={shortAnswer}
            onChange={(e) => setShortAnswer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleShortAnswerSubmit()}
            autoFocus
            placeholder="정답을 입력하세요..."
            disabled={disabled || showResult}
            className="w-full rounded-xl border-2 border-foreground/20 bg-background p-4 text-foreground placeholder:text-foreground/50 focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={handleShortAnswerSubmit}
            disabled={disabled || showResult || !shortAnswer.trim()}
            className="w-full rounded-xl bg-primary p-4 font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            제출하기
          </button>
        </div>
      )}

      {/* 정답/오답 피드백 */}
      {showResult && matchResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-6 p-4 rounded-xl ${
            isCorrectAnswer
              ? 'bg-success/10 border border-success/20'
              : 'bg-error/10 border border-error/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {isCorrectAnswer ? '🎉' : '😅'}
            </span>
            <div>
              <p className={`font-bold ${isCorrectAnswer ? 'text-success' : 'text-error'}`}>
                {matchResult.matchType === 'exact'
                  ? '정답입니다!'
                  : matchResult.matchType === 'similar'
                    ? `유사 정답입니다! (${Math.round(matchResult.similarity * 100)}% 일치)`
                    : '아쉽네요!'}
              </p>
              {matchResult.matchType === 'similar' && (
                <p className="text-sm text-foreground/70 mt-1">
                  대표 정답: <span className="font-medium text-success">{matchResult.displayAnswer}</span>
                </p>
              )}
              {!isCorrectAnswer && (
                <p className="text-sm text-foreground/70 mt-1">
                  정답: <span className="font-medium text-success">{matchResult.displayAnswer}</span>
                </p>
              )}
            </div>
          </div>
          {question.explanation && (
            <p className={`mt-3 ${
              explanationFontSize === 'sm' ? 'text-sm' :
              explanationFontSize === 'lg' ? 'text-lg' : 'text-base'
            } text-foreground/70 border-t border-foreground/10 pt-3 whitespace-pre-wrap`}>
              {question.explanation}
            </p>
          )}

          {/* 수동 모드일 때 다음 문제 버튼 + 편집 버튼 */}
          <div className="mt-4 flex gap-2">
            {canEdit && quizId && (
              <button
                onClick={handleOpenEdit}
                className="flex-1 rounded-xl bg-foreground/10 p-3 font-medium text-foreground transition-colors hover:bg-foreground/20"
              >
                문제 수정
              </button>
            )}
            {!autoNext && (
              <button
                onClick={() => onAnswer(selectedAnswer!, matchResult.isCorrect, matchResult)}
                className="flex-1 rounded-xl bg-primary p-3 font-medium text-white transition-colors hover:bg-primary-hover"
              >
                다음 문제 →
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* 문제 수정 모달 */}
      {canEdit && quizId && (
        <EditQuestionModal
          isOpen={showEditModal}
          question={question}
          quizId={quizId}
          onClose={handleCloseEdit}
          onSave={handleQuestionSave}
        />
      )}
    </motion.div>
  );
}
