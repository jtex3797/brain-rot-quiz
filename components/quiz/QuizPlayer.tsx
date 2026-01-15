'use client';

import { useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { QuestionCard } from './QuestionCard';
import { QuizResult } from './QuizResult';
import { ComboDisplay, ComboCounter } from './ComboDisplay';
import { useQuizCombo, useQuizProgress, useQuizAnswers } from '@/lib/hooks';
import type { Quiz } from '@/types';

interface QuizPlayerProps {
  quiz: Quiz;
}

export function QuizPlayer({ quiz }: QuizPlayerProps) {
  const totalQuestions = quiz.questions.length;

  // 커스텀 훅 사용
  const {
    combo,
    maxCombo,
    showAnimation: showComboAnimation,
    incrementCombo,
    resetCombo,
    resetAll: resetComboAll,
  } = useQuizCombo();

  const {
    currentIndex,
    isComplete,
    moveToNext,
    reset: resetProgress,
  } = useQuizProgress(totalQuestions);

  const {
    answers,
    recordAnswer,
    reset: resetAnswers,
  } = useQuizAnswers();

  const currentQuestion = quiz.questions[currentIndex];

  const handleAnswer = useCallback(
    (answer: string, isCorrect: boolean) => {
      // 답변 기록
      recordAnswer(currentQuestion.id, answer, isCorrect);

      // 콤보 처리
      if (isCorrect) {
        incrementCombo();
      } else {
        resetCombo();
      }

      // 다음 문제로 이동
      moveToNext();
    },
    [currentQuestion.id, recordAnswer, incrementCombo, resetCombo, moveToNext]
  );

  const handleRetry = useCallback(() => {
    resetProgress();
    resetAnswers();
    resetComboAll();
  }, [resetProgress, resetAnswers, resetComboAll]);

  if (isComplete) {
    return (
      <QuizResult
        quizTitle={quiz.title}
        questions={quiz.questions}
        answers={answers}
        maxCombo={maxCombo}
        onRetry={handleRetry}
      />
    );
  }

  return (
    <div className="w-full">
      {/* 상단 바 */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-sm z-40 pb-4">
        <div className="flex items-center justify-between mb-3">
          {/* 진행률 텍스트 */}
          <span className="text-sm text-foreground/60">
            {currentIndex + 1} / {totalQuestions}
          </span>

          {/* 콤보 카운터 */}
          <ComboCounter combo={combo} />
        </div>

        {/* 진행바 */}
        <ProgressBar
          value={currentIndex + 1}
          max={totalQuestions}
          color={combo >= 5 ? 'combo' : combo >= 2 ? 'success' : 'primary'}
        />
      </div>

      {/* 콤보 애니메이션 */}
      <ComboDisplay combo={combo} show={showComboAnimation} />

      {/* 문제 카드 */}
      <div className="mt-8">
        <AnimatePresence mode="wait">
          <QuestionCard
            key={currentQuestion.id}
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            totalQuestions={totalQuestions}
            onAnswer={handleAnswer}
            disabled={false}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
