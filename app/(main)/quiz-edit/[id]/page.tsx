'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { QuestionEditor } from '@/components/quiz-edit/QuestionEditor';
import { AddQuestionButton } from '@/components/quiz-edit/AddQuestionButton';
import type { Quiz, Question, QuizType, QuestionUpdate } from '@/types';

export default function QuizEditPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const quizId = params.id;

    const [originalQuiz, setOriginalQuiz] = useState<Quiz | null>(null);
    const [title, setTitle] = useState('');
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | null>(null);
    const [questions, setQuestions] = useState<QuestionUpdate[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 퀴즈 데이터 로드
    useEffect(() => {
        async function loadQuiz() {
            if (!quizId) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(`/api/quiz/${quizId}`);
                const data = await response.json();

                if (!data.quiz) {
                    setError('퀴즈를 찾을 수 없습니다');
                    return;
                }

                setOriginalQuiz(data.quiz);
                setTitle(data.quiz.title);
                setDifficulty(data.quiz.difficulty ?? null);
                setQuestions(
                    data.quiz.questions.map((q: Question) => ({
                        id: q.id,
                        type: q.type,
                        questionText: q.questionText,
                        options: q.options,
                        correctAnswers: q.correctAnswers,
                        explanation: q.explanation,
                    }))
                );
            } catch (err) {
                setError('퀴즈를 불러오는데 실패했습니다');
            } finally {
                setIsLoading(false);
            }
        }

        if (!authLoading && user) {
            loadQuiz();
        } else if (!authLoading && !user) {
            router.push('/auth/login');
        }
    }, [quizId, user, authLoading, router]);

    // 변경 감지
    const hasChanges = useMemo(() => {
        if (!originalQuiz) return false;

        const titleChanged = title !== originalQuiz.title;
        const questionsChanged =
            JSON.stringify(questions) !==
            JSON.stringify(
                originalQuiz.questions.map((q) => ({
                    id: q.id,
                    type: q.type,
                    questionText: q.questionText,
                    options: q.options,
                    correctAnswers: q.correctAnswers,
                    explanation: q.explanation,
                }))
            );

        return titleChanged || questionsChanged;
    }, [title, questions, originalQuiz]);

    // 이탈 방지
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    // 문제 수정
    const handleQuestionChange = (index: number, updated: QuestionUpdate) => {
        setQuestions((prev) => {
            const newQuestions = [...prev];
            newQuestions[index] = updated;
            return newQuestions;
        });
    };

    // 문제 삭제
    const handleQuestionDelete = (index: number) => {
        setQuestions((prev) => {
            const newQuestions = [...prev];
            if (newQuestions[index].id) {
                // 기존 문제: 삭제 마킹
                newQuestions[index] = { ...newQuestions[index], _delete: true };
            } else {
                // 새 문제: 바로 제거
                newQuestions.splice(index, 1);
            }
            return newQuestions;
        });
    };

    // 문제 추가
    const handleAddQuestion = (type: QuizType) => {
        const newQuestion: QuestionUpdate = {
            type,
            questionText: '',
            correctAnswers: [''],
            options: type === 'mcq' ? ['', '', '', ''] : undefined,
        };
        setQuestions((prev) => [...prev, newQuestion]);
    };

    // 저장
    const handleSave = async () => {
        if (!quizId) return;

        // 유효성 검사
        const activeQuestions = questions.filter((q) => !q._delete);
        if (activeQuestions.length === 0) {
            alert('최소 1개 이상의 문제가 필요합니다');
            return;
        }

        for (let i = 0; i < activeQuestions.length; i++) {
            const q = activeQuestions[i];
            if (!q.questionText.trim()) {
                alert(`${i + 1}번 문제의 질문을 입력해주세요`);
                return;
            }
            if (!q.correctAnswers[0]?.trim()) {
                alert(`${i + 1}번 문제의 정답을 입력해주세요`);
                return;
            }
        }

        setIsSaving(true);
        try {
            const response = await fetch(`/api/quiz/${quizId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    difficulty,
                    questions,
                }),
            });

            const result = await response.json();

            if (result.success) {
                alert('저장되었습니다');
                router.push('/my-quizzes');
            } else {
                alert('저장 실패: ' + result.error);
            }
        } catch (err) {
            alert('저장 중 오류가 발생했습니다');
        } finally {
            setIsSaving(false);
        }
    };

    // 취소
    const handleCancel = () => {
        if (hasChanges && !confirm('변경 사항이 저장되지 않습니다. 정말 나가시겠습니까?')) {
            return;
        }
        router.push('/my-quizzes');
    };

    // 로딩 상태
    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // 에러 상태
    if (error) {
        return (
            <PageContainer>
                <PageHeader
                    title="퀴즈 수정"
                    description={error}
                    backHref="/my-quizzes"
                />
                <div className="text-center py-8">
                    <Button onClick={() => router.push('/my-quizzes')}>
                        내 퀴즈로 돌아가기
                    </Button>
                </div>
            </PageContainer>
        );
    }

    const activeQuestions = questions.filter((q) => !q._delete);

    return (
        <PageContainer>
            <PageHeader
                title="퀴즈 수정"
                description="문제와 정답을 수정할 수 있습니다"
                backHref="/my-quizzes"
            />

            {/* 메타데이터 편집 */}
            <Card className="mb-6">
                <CardHeader>
                    <h2 className="text-lg font-semibold">퀴즈 정보</h2>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">제목</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="퀴즈 제목"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">난이도</label>
                        <select
                            value={difficulty ?? ''}
                            onChange={(e) =>
                                setDifficulty(
                                    (e.target.value as 'easy' | 'medium' | 'hard') || null
                                )
                            }
                            className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">미설정</option>
                            <option value="easy">쉬움</option>
                            <option value="medium">보통</option>
                            <option value="hard">어려움</option>
                        </select>
                    </div>
                </CardContent>
            </Card>

            {/* 문제 목록 */}
            <div className="space-y-4 mb-6">
                <h2 className="text-lg font-semibold">
                    문제 목록 ({activeQuestions.length}개)
                </h2>

                {questions.map((question, index) => {
                    if (question._delete) return null;

                    const displayIndex =
                        questions.slice(0, index).filter((q) => !q._delete).length + 1;

                    return (
                        <QuestionEditor
                            key={question.id ?? `new-${index}`}
                            question={question}
                            index={displayIndex}
                            onChange={(updated) => handleQuestionChange(index, updated)}
                            onDelete={() => handleQuestionDelete(index)}
                        />
                    );
                })}

                <AddQuestionButton onAdd={handleAddQuestion} />
            </div>

            {/* 저장/취소 버튼 */}
            <div className="sticky bottom-0 bg-background border-t border-border py-4 -mx-4 px-4 flex justify-end gap-3">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                    취소
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                >
                    {isSaving ? '저장 중...' : '저장하기'}
                </Button>
            </div>
        </PageContainer>
    );
}
