'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { Question, UserAnswer } from '@/types';

interface QuizResultProps {
  quizTitle: string;
  questions: Question[];
  answers: UserAnswer[];
  maxCombo: number;
  onRetry: () => void;
}

export function QuizResult({
  quizTitle,
  questions,
  answers,
  maxCombo,
  onRetry,
}: QuizResultProps) {
  const [showWrongAnswers, setShowWrongAnswers] = useState(false);

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const totalQuestions = questions.length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);

  const wrongAnswers = answers.filter((a) => !a.isCorrect);

  const getResultMessage = () => {
    if (percentage === 100) return { emoji: '🏆', text: '완벽해요!' };
    if (percentage >= 80) return { emoji: '🎉', text: '훌륭해요!' };
    if (percentage >= 60) return { emoji: '👍', text: '잘했어요!' };
    if (percentage >= 40) return { emoji: '💪', text: '더 노력해봐요!' };
    return { emoji: '📚', text: '다시 도전해요!' };
  };

  const result = getResultMessage();

  const getGradeColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 60) return 'text-combo';
    return 'text-error';
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-2xl mx-auto text-center"
    >
      {/* 결과 이모지 */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        className="text-8xl mb-4"
      >
        {result.emoji}
      </motion.div>

      {/* 결과 메시지 */}
      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-3xl font-bold text-foreground mb-2"
      >
        {result.text}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-foreground/60 mb-8"
      >
        {quizTitle}
      </motion.p>

      {/* 점수 카드 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-foreground/5 rounded-2xl p-6 mb-6"
      >
        <div className="grid grid-cols-3 gap-4">
          {/* 정답률 */}
          <div className="text-center">
            <div className={`text-4xl font-black ${getGradeColor()}`}>
              {percentage}%
            </div>
            <div className="text-sm text-foreground/60 mt-1">정답률</div>
          </div>

          {/* 맞은 문제 */}
          <div className="text-center border-x border-foreground/10">
            <div className="text-4xl font-black text-foreground">
              {correctCount}/{totalQuestions}
            </div>
            <div className="text-sm text-foreground/60 mt-1">정답</div>
          </div>

          {/* 최대 콤보 */}
          <div className="text-center">
            <div className="text-4xl font-black text-combo">
              {maxCombo}x
            </div>
            <div className="text-sm text-foreground/60 mt-1">최대 콤보</div>
          </div>
        </div>
      </motion.div>

      {/* 틀린 문제 섹션 */}
      {wrongAnswers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mb-8"
        >
          <button
            onClick={() => setShowWrongAnswers(!showWrongAnswers)}
            className="w-full flex items-center justify-between p-4 bg-error/5 rounded-xl text-left hover:bg-error/10 transition-colors"
          >
            <span className="font-medium text-error">
              틀린 문제 {wrongAnswers.length}개
            </span>
            <span className="text-error">
              {showWrongAnswers ? '▲' : '▼'}
            </span>
          </button>

          {showWrongAnswers && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-2 space-y-3"
            >
              {wrongAnswers.map((answer) => {
                const question = questions.find((q) => q.id === answer.questionId);
                if (!question) return null;

                return (
                  <div
                    key={answer.questionId}
                    className="p-4 bg-foreground/5 rounded-xl text-left"
                  >
                    <p className="font-medium text-foreground mb-2">
                      {question.questionText}
                    </p>
                    <div className="flex gap-4 text-sm">
                      <span className="text-error">
                        내 답: {answer.userAnswer}
                      </span>
                      <span className="text-success">
                        정답: {question.correctAnswer}
                      </span>
                    </div>
                    {question.explanation && (
                      <p className="mt-2 text-sm text-foreground/60">
                        {question.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </motion.div>
      )}

      {/* 버튼 그룹 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="flex flex-col sm:flex-row gap-3 justify-center"
      >
        <Button onClick={onRetry} variant="primary" size="lg">
          다시 풀기
        </Button>
        <Link href="/upload">
          <Button variant="outline" size="lg" className="w-full sm:w-auto">
            새 퀴즈 만들기
          </Button>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="lg" className="w-full sm:w-auto">
            홈으로
          </Button>
        </Link>
      </motion.div>
    </motion.div>
  );
}
