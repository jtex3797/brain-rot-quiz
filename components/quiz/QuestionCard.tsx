'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { OptionButton, OptionState } from './OptionButton';
import type { Question } from '@/types';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: string, isCorrect: boolean) => void;
  disabled: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled,
}: QuestionCardProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [shortAnswer, setShortAnswer] = useState('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 문제가 바뀔 때 상태 초기화 및 타이머 정리
  useEffect(() => {
    setSelectedAnswer(null);
    setShowResult(false);
    setShortAnswer('');

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [question.id]);

  const handleOptionClick = (option: string) => {
    if (disabled || showResult) return;

    setSelectedAnswer(option);
    setShowResult(true);

    const isCorrect = option === question.correctAnswer;

    // 1.5초 후 다음 문제로
    timeoutRef.current = setTimeout(() => {
      onAnswer(option, isCorrect);
    }, 1500);
  };

  const handleShortAnswerSubmit = () => {
    if (disabled || showResult || !shortAnswer.trim()) return;

    setSelectedAnswer(shortAnswer.trim());
    setShowResult(true);

    // 대소문자 무시하고 비교
    const isCorrect = shortAnswer.trim().toLowerCase() === question.correctAnswer.toLowerCase();

    timeoutRef.current = setTimeout(() => {
      onAnswer(shortAnswer.trim(), isCorrect);
    }, 1500);
  };

  const getOptionState = (option: string): OptionState => {
    if (!showResult) {
      return selectedAnswer === option ? 'selected' : 'default';
    }

    if (option === question.correctAnswer) {
      return selectedAnswer === option ? 'correct' : 'reveal';
    }

    if (selectedAnswer === option) {
      return 'wrong';
    }

    return 'default';
  };

  // 단답형의 경우 대소문자 무시 비교
  const isCorrectAnswer = question.type === 'short' || question.type === 'fill'
    ? selectedAnswer?.toLowerCase() === question.correctAnswer.toLowerCase()
    : selectedAnswer === question.correctAnswer;

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
      {showResult && (
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
                {isCorrectAnswer ? '정답입니다!' : '아쉽네요!'}
              </p>
              {!isCorrectAnswer && (
                <p className="text-sm text-foreground/70 mt-1">
                  정답: <span className="font-medium text-success">{question.correctAnswer}</span>
                </p>
              )}
            </div>
          </div>
          {question.explanation && (
            <p className="mt-3 text-sm text-foreground/70 border-t border-foreground/10 pt-3">
              {question.explanation}
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
