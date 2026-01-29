'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import type { Question, QuizType } from '@/types';

interface EditQuestionModalProps {
  isOpen: boolean;
  question: Question;
  quizId: string;
  onClose: () => void;
  onSave: (updated: Question) => void;
}

const TYPE_LABELS: Record<QuizType, string> = {
  mcq: '객관식',
  ox: 'O/X',
  short: '단답형',
  fill: '빈칸',
};

export function EditQuestionModal({
  isOpen,
  question,
  quizId,
  onClose,
  onSave,
}: EditQuestionModalProps) {
  const [editedQuestion, setEditedQuestion] = useState<Question>(question);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 질문 텍스트 변경
  const handleTextChange = (value: string) => {
    setEditedQuestion({ ...editedQuestion, questionText: value });
  };

  // 정답 변경
  const handleAnswerChange = (answerIndex: number, value: string) => {
    const newAnswers = [...editedQuestion.correctAnswers];
    newAnswers[answerIndex] = value;
    setEditedQuestion({ ...editedQuestion, correctAnswers: newAnswers });
  };

  // 대안 정답 추가
  const handleAddAlternativeAnswer = () => {
    setEditedQuestion({
      ...editedQuestion,
      correctAnswers: [...editedQuestion.correctAnswers, ''],
    });
  };

  // 대안 정답 삭제
  const handleRemoveAlternativeAnswer = (answerIndex: number) => {
    if (editedQuestion.correctAnswers.length <= 1) return;
    const newAnswers = editedQuestion.correctAnswers.filter((_, i) => i !== answerIndex);
    setEditedQuestion({ ...editedQuestion, correctAnswers: newAnswers });
  };

  // 보기 변경 (객관식)
  const handleOptionChange = (optionIndex: number, value: string) => {
    if (!editedQuestion.options) return;
    const newOptions = [...editedQuestion.options];
    newOptions[optionIndex] = value;
    setEditedQuestion({ ...editedQuestion, options: newOptions });
  };

  // 보기 추가
  const handleAddOption = () => {
    setEditedQuestion({
      ...editedQuestion,
      options: [...(editedQuestion.options ?? []), ''],
    });
  };

  // 보기 삭제
  const handleRemoveOption = (optionIndex: number) => {
    if (!editedQuestion.options || editedQuestion.options.length <= 2) return;
    const newOptions = editedQuestion.options.filter((_, i) => i !== optionIndex);
    setEditedQuestion({ ...editedQuestion, options: newOptions });
  };

  // 해설 변경
  const handleExplanationChange = (value: string) => {
    setEditedQuestion({ ...editedQuestion, explanation: value || undefined });
  };

  // O/X 정답 토글
  const handleOXToggle = (answer: 'O' | 'X') => {
    setEditedQuestion({ ...editedQuestion, correctAnswers: [answer] });
  };

  // 저장
  const handleSave = async () => {
    // 유효성 검사
    if (!editedQuestion.questionText.trim()) {
      setError('질문을 입력해주세요');
      return;
    }
    if (!editedQuestion.correctAnswers[0]?.trim()) {
      setError('정답을 입력해주세요');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/quiz/${quizId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: [{
            id: editedQuestion.id,
            type: editedQuestion.type,
            questionText: editedQuestion.questionText,
            options: editedQuestion.options,
            correctAnswers: editedQuestion.correctAnswers.filter(a => a.trim()),
            explanation: editedQuestion.explanation,
          }],
        }),
      });

      const result = await response.json();

      if (result.success) {
        onSave(editedQuestion);
        onClose();
      } else {
        setError(result.error || '저장에 실패했습니다');
      }
    } catch {
      setError('저장 중 오류가 발생했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-background rounded-2xl p-6 max-w-lg w-full shadow-xl border border-foreground/10 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">문제 수정</h2>
              <span className="px-2 py-0.5 text-xs rounded bg-foreground/10">
                {TYPE_LABELS[editedQuestion.type]}
              </span>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-error text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* 질문 텍스트 */}
              <div>
                <label className="block text-sm font-medium mb-1">질문</label>
                <textarea
                  value={editedQuestion.questionText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={3}
                  placeholder="질문을 입력하세요"
                />
              </div>

              {/* 객관식 보기 */}
              {editedQuestion.type === 'mcq' && editedQuestion.options && (
                <div>
                  <label className="block text-sm font-medium mb-1">보기</label>
                  <div className="space-y-2">
                    {editedQuestion.options.map((option, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <span className="w-6 text-center text-sm text-foreground/60">
                          {optIdx + 1}.
                        </span>
                        <input
                          type="text"
                          value={option}
                          onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                          className="flex-1 px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={`보기 ${optIdx + 1}`}
                        />
                        {editedQuestion.options && editedQuestion.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(optIdx)}
                            className="p-2 text-foreground/60 hover:text-error"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddOption}
                    >
                      + 보기 추가
                    </Button>
                  </div>
                </div>
              )}

              {/* 정답 */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  정답 {editedQuestion.type !== 'ox' && '(여러 개 입력 가능)'}
                </label>

                {editedQuestion.type === 'ox' ? (
                  <div className="flex gap-3">
                    <Button
                      variant={editedQuestion.correctAnswers[0] === 'O' ? 'primary' : 'outline'}
                      size="lg"
                      onClick={() => handleOXToggle('O')}
                      className="w-20"
                    >
                      O
                    </Button>
                    <Button
                      variant={editedQuestion.correctAnswers[0] === 'X' ? 'primary' : 'outline'}
                      size="lg"
                      onClick={() => handleOXToggle('X')}
                      className="w-20"
                    >
                      X
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editedQuestion.correctAnswers.map((answer, ansIdx) => (
                      <div key={ansIdx} className="flex items-center gap-2">
                        <span className="text-xs text-foreground/60 w-16">
                          {ansIdx === 0 ? '대표 정답' : `대안 ${ansIdx}`}
                        </span>
                        <input
                          type="text"
                          value={answer}
                          onChange={(e) => handleAnswerChange(ansIdx, e.target.value)}
                          className="flex-1 px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder={ansIdx === 0 ? '정답' : '대안 정답 (선택)'}
                        />
                        {ansIdx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveAlternativeAnswer(ansIdx)}
                            className="p-2 text-foreground/60 hover:text-error"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {editedQuestion.type !== 'mcq' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleAddAlternativeAnswer}
                      >
                        + 대안 정답 추가
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* 해설 */}
              <div>
                <label className="block text-sm font-medium mb-1">해설 (선택)</label>
                <textarea
                  value={editedQuestion.explanation ?? ''}
                  onChange={(e) => handleExplanationChange(e.target.value)}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  rows={2}
                  placeholder="해설을 입력하세요 (선택사항)"
                />
              </div>
            </div>

            {/* 버튼 그룹 */}
            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
                disabled={isSaving}
              >
                취소
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                className="flex-1"
                loading={isSaving}
              >
                저장
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
