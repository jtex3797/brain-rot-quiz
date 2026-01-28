'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { QuestionUpdate, QuizType } from '@/types';

interface QuestionEditorProps {
    question: QuestionUpdate;
    index: number;
    onChange: (updated: QuestionUpdate) => void;
    onDelete: () => void;
}

const TYPE_LABELS: Record<QuizType, string> = {
    mcq: '객관식',
    ox: 'O/X',
    short: '단답형',
    fill: '빈칸',
};

export function QuestionEditor({
    question,
    index,
    onChange,
    onDelete,
}: QuestionEditorProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    // 질문 텍스트 변경
    const handleTextChange = (value: string) => {
        onChange({ ...question, questionText: value });
    };

    // 정답 변경
    const handleAnswerChange = (answerIndex: number, value: string) => {
        const newAnswers = [...question.correctAnswers];
        newAnswers[answerIndex] = value;
        onChange({ ...question, correctAnswers: newAnswers });
    };

    // 대안 정답 추가
    const handleAddAlternativeAnswer = () => {
        onChange({
            ...question,
            correctAnswers: [...question.correctAnswers, ''],
        });
    };

    // 대안 정답 삭제
    const handleRemoveAlternativeAnswer = (answerIndex: number) => {
        if (question.correctAnswers.length <= 1) return;
        const newAnswers = question.correctAnswers.filter((_, i) => i !== answerIndex);
        onChange({ ...question, correctAnswers: newAnswers });
    };

    // 보기 변경 (객관식)
    const handleOptionChange = (optionIndex: number, value: string) => {
        if (!question.options) return;
        const newOptions = [...question.options];
        newOptions[optionIndex] = value;
        onChange({ ...question, options: newOptions });
    };

    // 보기 추가
    const handleAddOption = () => {
        onChange({
            ...question,
            options: [...(question.options ?? []), ''],
        });
    };

    // 보기 삭제
    const handleRemoveOption = (optionIndex: number) => {
        if (!question.options || question.options.length <= 2) return;
        const newOptions = question.options.filter((_, i) => i !== optionIndex);
        onChange({ ...question, options: newOptions });
    };

    // 해설 변경
    const handleExplanationChange = (value: string) => {
        onChange({ ...question, explanation: value || undefined });
    };

    // O/X 정답 토글
    const handleOXToggle = (answer: 'O' | 'X') => {
        onChange({ ...question, correctAnswers: [answer] });
    };

    return (
        <Card>
            <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-primary">Q{index}</span>
                        <span className="px-2 py-0.5 text-xs rounded bg-foreground/10">
                            {TYPE_LABELS[question.type]}
                        </span>
                        <span className="text-sm text-foreground/60 truncate max-w-[300px]">
                            {question.questionText || '(질문 없음)'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('이 문제를 삭제하시겠습니까?')) {
                                    onDelete();
                                }
                            }}
                            className="text-error hover:bg-error/10"
                        >
                            삭제
                        </Button>
                        <span className="text-foreground/40">
                            {isExpanded ? '▼' : '▶'}
                        </span>
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4 pt-0">
                    {/* 질문 텍스트 */}
                    <div>
                        <label className="block text-sm font-medium mb-1">질문</label>
                        <textarea
                            value={question.questionText}
                            onChange={(e) => handleTextChange(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            rows={3}
                            placeholder="질문을 입력하세요"
                        />
                    </div>

                    {/* 객관식 보기 */}
                    {question.type === 'mcq' && question.options && (
                        <div>
                            <label className="block text-sm font-medium mb-1">보기</label>
                            <div className="space-y-2">
                                {question.options.map((option, optIdx) => (
                                    <div key={optIdx} className="flex items-center gap-2">
                                        <span className="w-6 text-center text-sm text-foreground/60">
                                            {optIdx + 1}.
                                        </span>
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={(e) => handleOptionChange(optIdx, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                            placeholder={`보기 ${optIdx + 1}`}
                                        />
                                        {question.options && question.options.length > 2 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveOption(optIdx)}
                                            >
                                                ×
                                            </Button>
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
                            정답 {question.type !== 'ox' && '(여러 개 입력 가능)'}
                        </label>

                        {question.type === 'ox' ? (
                            <div className="flex gap-3">
                                <Button
                                    variant={question.correctAnswers[0] === 'O' ? 'primary' : 'outline'}
                                    size="lg"
                                    onClick={() => handleOXToggle('O')}
                                    className="w-20"
                                >
                                    O
                                </Button>
                                <Button
                                    variant={question.correctAnswers[0] === 'X' ? 'primary' : 'outline'}
                                    size="lg"
                                    onClick={() => handleOXToggle('X')}
                                    className="w-20"
                                >
                                    X
                                </Button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {question.correctAnswers.map((answer, ansIdx) => (
                                    <div key={ansIdx} className="flex items-center gap-2">
                                        <span className="text-xs text-foreground/60 w-16">
                                            {ansIdx === 0 ? '대표 정답' : `대안 ${ansIdx}`}
                                        </span>
                                        <input
                                            type="text"
                                            value={answer}
                                            onChange={(e) => handleAnswerChange(ansIdx, e.target.value)}
                                            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                                            placeholder={ansIdx === 0 ? '정답' : '대안 정답 (선택)'}
                                        />
                                        {ansIdx > 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveAlternativeAnswer(ansIdx)}
                                            >
                                                ×
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                {question.type !== 'mcq' && (
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
                            value={question.explanation ?? ''}
                            onChange={(e) => handleExplanationChange(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                            rows={2}
                            placeholder="해설을 입력하세요 (선택사항)"
                        />
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
