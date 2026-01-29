'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';

interface QuestionSnapshot {
    type: string;
    questionText: string;
    options?: string[];
    correctAnswers: string[];
    explanation?: string;
}

interface WrongAnswer {
    id: string;
    quiz_id: string | null;
    question_id: string | null;
    quiz_title: string;
    question_snapshot: QuestionSnapshot;
    user_answer: string;
    wrong_count: number;
    is_outdated: boolean;
    is_resolved: boolean;
    first_wrong_at: string;
    last_wrong_at: string;
    resolved_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
    mcq: '객관식',
    ox: 'O/X',
    short: '단답형',
    fill: '빈칸',
};

export default function WrongAnswersPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showResolved, setShowResolved] = useState(false);
    const [showOutdated, setShowOutdated] = useState(false);
    const [selectedQuizId, setSelectedQuizId] = useState<string>('all');
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // 고유 퀴즈 목록 추출
    const quizOptions = useMemo(() => {
        const quizMap = new Map<string, string>();
        wrongAnswers.forEach((wa) => {
            if (wa.quiz_id && wa.quiz_title) {
                quizMap.set(wa.quiz_id, wa.quiz_title);
            }
        });
        return Array.from(quizMap.entries()).map(([id, title]) => ({
            id,
            title,
        }));
    }, [wrongAnswers]);

    // 필터링된 오답 목록
    const filteredWrongAnswers = useMemo(() => {
        if (selectedQuizId === 'all') return wrongAnswers;
        return wrongAnswers.filter((wa) => wa.quiz_id === selectedQuizId);
    }, [wrongAnswers, selectedQuizId]);

    // 오답 목록 로드
    useEffect(() => {
        async function loadWrongAnswers() {
            if (!user) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                const params = new URLSearchParams();
                if (showResolved) params.set('includeResolved', 'true');
                if (showOutdated) params.set('includeOutdated', 'true');

                const response = await fetch(`/api/wrong-answers?${params}`);
                const data = await response.json();
                setWrongAnswers(data.wrongAnswers ?? []);
            } catch (error) {
                console.error('오답 목록 로드 실패:', error);
                setWrongAnswers([]);
            } finally {
                setIsLoading(false);
            }
        }

        if (!authLoading) {
            loadWrongAnswers();
        }
    }, [user, authLoading, showResolved, showOutdated]);

    // 오답 삭제
    async function handleDelete(wrongAnswerId: string) {
        if (!confirm('이 오답 기록을 삭제하시겠습니까?')) return;

        setDeletingId(wrongAnswerId);
        try {
            const response = await fetch(`/api/wrong-answers?id=${wrongAnswerId}`, {
                method: 'DELETE',
            });
            const result = await response.json();

            if (result.success) {
                setWrongAnswers((prev) => prev.filter((w) => w.id !== wrongAnswerId));
            } else {
                alert('삭제 실패: ' + result.error);
            }
        } catch (error) {
            alert('삭제 중 오류가 발생했습니다');
        }
        setDeletingId(null);
    }

    // 로딩 상태
    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // 비로그인 상태
    if (!user) {
        return (
            <PageContainer>
                <PageHeader title="오답노트" description="틀린 문제를 복습하세요" />
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-foreground/70 mb-4">
                            오답노트를 보려면 로그인이 필요합니다
                        </p>
                        <Link href="/auth/login">
                            <Button variant="primary">로그인하기</Button>
                        </Link>
                    </CardContent>
                </Card>
            </PageContainer>
        );
    }

    return (
        <PageContainer>
            <PageHeader
                title="오답노트"
                description={`총 ${filteredWrongAnswers.length}개의 오답`}
                backHref="/"
            />

            {/* 오답 복습하기 버튼 */}
            {filteredWrongAnswers.length > 0 && (
                <div className="mb-6">
                    <Button
                        variant="primary"
                        onClick={() => {
                            const quizParam = selectedQuizId !== 'all' ? `?quizId=${selectedQuizId}` : '';
                            router.push(`/wrong-review${quizParam}`);
                        }}
                    >
                        오답 복습하기 ({filteredWrongAnswers.length}문제)
                    </Button>
                </div>
            )}

            {/* 필터 옵션 */}
            <div className="flex flex-wrap gap-4 mb-6">
                {/* 퀴즈 선택 드롭다운 */}
                <div className="flex items-center gap-2">
                    <label htmlFor="quiz-filter" className="text-sm">
                        퀴즈:
                    </label>
                    <select
                        id="quiz-filter"
                        value={selectedQuizId}
                        onChange={(e) => setSelectedQuizId(e.target.value)}
                        className="px-3 py-1.5 text-sm rounded-md border border-border bg-background"
                    >
                        <option value="all">전체 ({wrongAnswers.length})</option>
                        {quizOptions.map((quiz) => (
                            <option key={quiz.id} value={quiz.id}>
                                {quiz.title} ({wrongAnswers.filter((wa) => wa.quiz_id === quiz.id).length})
                            </option>
                        ))}
                    </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showResolved}
                        onChange={(e) => setShowResolved(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <span className="text-sm">해결된 문제 포함</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showOutdated}
                        onChange={(e) => setShowOutdated(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <span className="text-sm">수정된 문제 포함</span>
                </label>
            </div>

            {/* 빈 상태 */}
            {filteredWrongAnswers.length === 0 && (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-foreground/70 mb-4">
                            오답이 없습니다! 대단해요! 🎉
                        </p>
                        <Link href="/upload">
                            <Button variant="primary">새 퀴즈 풀기</Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {/* 오답 목록 */}
            <div className="space-y-4">
                {filteredWrongAnswers.map((wrong) => {
                    const isExpanded = expandedId === wrong.id;
                    const snapshot = wrong.question_snapshot;

                    return (
                        <Card key={wrong.id} className={wrong.is_outdated ? 'opacity-60' : ''}>
                            <CardHeader
                                className="cursor-pointer"
                                onClick={() => setExpandedId(isExpanded ? null : wrong.id)}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="px-2 py-0.5 text-xs rounded bg-foreground/10">
                                                {TYPE_LABELS[snapshot.type] ?? snapshot.type}
                                            </span>
                                            {wrong.is_resolved && (
                                                <span className="px-2 py-0.5 text-xs rounded bg-success/20 text-success">
                                                    해결됨
                                                </span>
                                            )}
                                            {wrong.is_outdated && (
                                                <span className="px-2 py-0.5 text-xs rounded bg-combo/20 text-combo">
                                                    수정됨
                                                </span>
                                            )}
                                            {wrong.wrong_count > 1 && (
                                                <span className="px-2 py-0.5 text-xs rounded bg-error/20 text-error">
                                                    {wrong.wrong_count}회 오답
                                                </span>
                                            )}
                                        </div>
                                        <p className="font-medium truncate">
                                            {snapshot.questionText}
                                        </p>
                                        <p className="text-sm text-foreground/60">
                                            {wrong.quiz_title}
                                        </p>
                                    </div>
                                    <span className="text-foreground/40">
                                        {isExpanded ? '▼' : '▶'}
                                    </span>
                                </div>
                            </CardHeader>

                            {isExpanded && (
                                <CardContent className="pt-0 space-y-4">
                                    {/* 보기 (객관식) */}
                                    {snapshot.options && (
                                        <div>
                                            <p className="text-sm font-medium mb-2">보기</p>
                                            <ul className="space-y-1">
                                                {snapshot.options.map((opt, idx) => (
                                                    <li
                                                        key={idx}
                                                        className={`text-sm px-3 py-1 rounded ${
                                                            snapshot.correctAnswers.includes(opt)
                                                                ? 'bg-success/10 text-success'
                                                                : opt === wrong.user_answer
                                                                ? 'bg-error/10 text-error'
                                                                : ''
                                                        }`}
                                                    >
                                                        {idx + 1}. {opt}
                                                        {snapshot.correctAnswers.includes(opt) && ' ✓'}
                                                        {opt === wrong.user_answer && ' (내 답변)'}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* 내 답변 / 정답 */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm font-medium mb-1">내 답변</p>
                                            <p className="text-error">{wrong.user_answer || '(무응답)'}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium mb-1">정답</p>
                                            <p className="text-success">
                                                {snapshot.correctAnswers.join(' / ')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* 해설 */}
                                    {snapshot.explanation && (
                                        <div>
                                            <p className="text-sm font-medium mb-1">해설</p>
                                            <p className="text-sm text-foreground/70">
                                                {snapshot.explanation}
                                            </p>
                                        </div>
                                    )}

                                    {/* 액션 버튼 */}
                                    <div className="flex items-center gap-2 pt-2 border-t border-border">
                                        {wrong.quiz_id && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => router.push(`/quiz/${wrong.quiz_id}`)}
                                            >
                                                퀴즈 풀기
                                            </Button>
                                        )}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(wrong.id)}
                                            disabled={deletingId === wrong.id}
                                            className="text-error"
                                        >
                                            {deletingId === wrong.id ? '삭제 중...' : '삭제'}
                                        </Button>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    );
                })}
            </div>
        </PageContainer>
    );
}
