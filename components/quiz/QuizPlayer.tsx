'use client';

import { useCallback, useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { AutoNextToggle } from '@/components/ui/AutoNextToggle';
import { useAutoNextSettings } from '@/contexts/AutoNextContext';
import { QuestionCard } from './QuestionCard';
import { QuizResult } from './QuizResult';
import { ComboDisplay, ComboCounter } from './ComboDisplay';
import {
  useQuizCombo,
  useQuizProgress,
  useQuizAnswers,
  useQuizSession,
} from '@/lib/hooks';
import type { Quiz } from '@/types';
import type { MatchResult } from '@/lib/quiz/answerMatcher';

interface QuizPlayerProps {
  quiz: Quiz;
  isDbQuiz?: boolean;
  onLoadMore?: (count: number) => Promise<void>;
  isLoadingMore?: boolean;
  remainingCount?: number;
  onResetAll?: () => Promise<void>;
  backHref?: string;
}

export function QuizPlayer({
  quiz,
  isDbQuiz = false,
  onLoadMore,
  isLoadingMore = false,
  remainingCount,
  onResetAll,
  backHref,
}: QuizPlayerProps) {
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

  const { submitSession, sessionResult, resetSession } = useQuizSession();
  const { enabled: autoNext } = useAutoNextSettings();

  // 세션 제출 여부 추적 (중복 제출 방지)
  const sessionSubmittedRef = useRef(false);

  const currentQuestion = quiz.questions[currentIndex];

  // 퀴즈 완료 시 세션 저장
  useEffect(() => {
    if (isComplete && !sessionSubmittedRef.current) {
      sessionSubmittedRef.current = true;

      // DB 퀴즈인 경우 questionId 매핑 생성
      const questionIdMap = isDbQuiz
        ? new Map(quiz.questions.map((q) => [q.id, q.id]))
        : undefined;

      submitSession(
        isDbQuiz ? quiz.id : null,
        answers,
        maxCombo,
        questionIdMap,
        isDbQuiz ? quiz.title : undefined, // 오답노트용
        isDbQuiz ? quiz.questions : undefined // 오답노트용
      );
    }
  }, [isComplete, isDbQuiz, quiz.id, quiz.title, quiz.questions, answers, maxCombo, submitSession]);

  const handleAnswer = useCallback(
    (answer: string, isCorrect: boolean, matchResult?: MatchResult) => {
      // currentQuestion이 없으면 무시 (더 풀기 로딩 중 방지)
      if (!currentQuestion) return;

      // 답변 기록
      recordAnswer(currentQuestion.id, answer, isCorrect, matchResult?.matchType, matchResult?.similarity);

      // 콤보 처리
      if (isCorrect) {
        incrementCombo();
      } else {
        resetCombo();
      }

      // 다음 문제로 이동
      moveToNext();
    },
    [currentQuestion, recordAnswer, incrementCombo, resetCombo, moveToNext]
  );

  const handleRetry = useCallback(() => {
    resetProgress();
    resetAnswers();
    resetComboAll();
    resetSession();
    sessionSubmittedRef.current = false;
  }, [resetProgress, resetAnswers, resetComboAll, resetSession]);

  if (isComplete) {
    return (
      <QuizResult
        quizTitle={quiz.title}
        questions={quiz.questions}
        answers={answers}
        maxCombo={maxCombo}
        onRetry={handleRetry}
        sessionResult={sessionResult}
        bankId={quiz.bankId}
        remainingCount={remainingCount ?? quiz.remainingCount}
        onLoadMore={onLoadMore}
        isLoadingMore={isLoadingMore}
        onResetAll={onResetAll}
        sessionSize={quiz.sessionSize ?? quiz.requestedQuestionCount}
        backHref={backHref}
      />
    );
  }

  // currentQuestion이 없으면 로딩 표시 (더 풀기 로딩 중)
  if (!currentQuestion) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-foreground/70">문제를 불러오는 중...</p>
        </div>
      </div>
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

          {/* 자동넘김 + 사운드 토글 + 콤보 카운터 */}
          <div className="flex items-center gap-2">
            <AutoNextToggle />
            <SoundToggle />
            <ComboCounter combo={combo} />
          </div>
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
            autoNext={autoNext}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
