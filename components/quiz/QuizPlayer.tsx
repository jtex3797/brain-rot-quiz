'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SoundToggle } from '@/components/ui/SoundToggle';
import { AutoNextToggle } from '@/components/ui/AutoNextToggle';
import { useAutoNextSettings } from '@/contexts/AutoNextContext';
import { useAuth } from '@/contexts/AuthContext';
import { QuestionCard } from './QuestionCard';
import { QuizResult } from './QuizResult';
import { COMBO_THRESHOLDS, getComboBgColor } from '@/lib/constants';
import {
  useQuizCombo,
  useQuizProgress,
  useQuizAnswers,
  useQuizSession,
} from '@/lib/hooks';
import type { Quiz, Question } from '@/types';
import type { MatchResult } from '@/lib/quiz/answerMatcher';

interface QuizPlayerProps {
  quiz: Quiz;
  isDbQuiz?: boolean;
  quizOwnerId?: string;  // 퀴즈 소유자 ID (플레이 중 수정용)
  externalQuestionIdMap?: Record<string, string>;  // 외부에서 전달하는 questionId 매핑 (오답 복습용)
  onLoadMore?: (count: number) => Promise<void>;
  isLoadingMore?: boolean;
  remainingCount?: number;
  onResetAll?: () => Promise<void>;
  backHref?: string;
  onQuizUpdate?: (updatedQuiz: Quiz) => void;  // 퀴즈 수정 시 상위 상태 업데이트
}

export function QuizPlayer({
  quiz,
  isDbQuiz = false,
  quizOwnerId,
  externalQuestionIdMap,
  onLoadMore,
  isLoadingMore = false,
  remainingCount,
  onResetAll,
  backHref,
  onQuizUpdate,
}: QuizPlayerProps) {
  const { user } = useAuth();
  const [localQuestions, setLocalQuestions] = useState<Question[]>(quiz.questions);
  const totalQuestions = localQuestions.length;

  // 소유권 확인: DB 퀴즈 + 로그인 + 본인 소유
  const canEdit = isDbQuiz && !!user && !!quizOwnerId && user.id === quizOwnerId;

  // quiz.questions가 변경되면 로컬 상태 동기화
  useEffect(() => {
    setLocalQuestions(quiz.questions);
  }, [quiz.questions]);

  // 커스텀 훅 사용
  const {
    combo,
    maxCombo,
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

  const currentQuestion = localQuestions[currentIndex];

  // 문제 수정 완료 시 처리
  const handleQuestionUpdate = useCallback((updated: Question) => {
    // 로컬 상태 업데이트
    setLocalQuestions(prev =>
      prev.map(q => q.id === updated.id ? updated : q)
    );

    // 상위 컴포넌트에 알림
    if (onQuizUpdate) {
      onQuizUpdate({
        ...quiz,
        questions: localQuestions.map(q => q.id === updated.id ? updated : q),
      });
    }
  }, [quiz, localQuestions, onQuizUpdate]);

  // 퀴즈 완료 시 세션 저장
  useEffect(() => {
    if (isComplete && !sessionSubmittedRef.current) {
      sessionSubmittedRef.current = true;

      // questionId 매핑 생성
      // 1. 외부에서 전달된 매핑이 있으면 사용 (오답 복습용)
      // 2. DB 퀴즈인 경우 자체 생성
      // 3. 그 외에는 undefined
      let questionIdMap: Map<string, string> | undefined;
      if (externalQuestionIdMap && Object.keys(externalQuestionIdMap).length > 0) {
        questionIdMap = new Map(Object.entries(externalQuestionIdMap));
      } else if (isDbQuiz) {
        questionIdMap = new Map(localQuestions.map((q) => [q.id, q.id]));
      }

      // 오답 복습용일 때도 resolved 처리를 위해 questionIdMap 전달
      const hasQuestionIdMap = questionIdMap && questionIdMap.size > 0;

      submitSession(
        isDbQuiz ? quiz.id : null,
        answers,
        maxCombo,
        questionIdMap,
        (isDbQuiz || hasQuestionIdMap) ? quiz.title : undefined, // 오답노트용
        (isDbQuiz || hasQuestionIdMap) ? localQuestions : undefined // 오답노트용
      );
    }
  }, [isComplete, isDbQuiz, externalQuestionIdMap, quiz.id, quiz.title, localQuestions, answers, maxCombo, submitSession]);

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
        questions={localQuestions}
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
          {/* 진행률 + 콤보 뱃지 */}
          <div className="flex items-center gap-2">
            {/* 문제 수 뱃지 */}
            <div className="bg-foreground/10 px-3 py-1 rounded-full font-semibold text-sm">
              {currentIndex + 1} / {totalQuestions}
            </div>

            {/* 콤보 뱃지 */}
            {combo >= COMBO_THRESHOLDS.MIN_DISPLAY && (
              <motion.div
                key={combo}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`${getComboBgColor(combo)} text-white px-3 py-1 rounded-full font-bold text-sm flex items-center gap-1`}
              >
                <span>🔥</span>
                <span>{combo}x</span>
              </motion.div>
            )}
          </div>

          {/* 자동넘김 + 사운드 토글 */}
          <div className="flex items-center gap-2">
            <AutoNextToggle />
            <SoundToggle />
          </div>
        </div>

        {/* 진행바 */}
        <ProgressBar
          value={currentIndex + 1}
          max={totalQuestions}
          color={combo >= 5 ? 'combo' : combo >= 2 ? 'success' : 'primary'}
        />
      </div>


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
            canEdit={canEdit}
            quizId={quiz.id}
            onQuestionUpdate={handleQuestionUpdate}
          />
        </AnimatePresence>
      </div>
    </div>
  );
}
