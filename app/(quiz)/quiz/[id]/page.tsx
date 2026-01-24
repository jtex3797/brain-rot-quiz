'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { Button } from '@/components/ui/Button';
import { getQuizFromLocal, saveQuizToLocal } from '@/lib/utils/storage';
import { useAuth } from '@/contexts/AuthContext';
import { getQuizFromDb } from '@/lib/supabase/quiz';
import { ERROR_MESSAGES } from '@/lib/constants';
import { MinimalHeader } from '@/components/layout/MinimalHeader';
import type { Quiz, Question } from '@/types';

type PageState = 'loading' | 'error' | 'ready';

export default function QuizPage() {
    const params = useParams<{ id: string }>();
    const { user } = useAuth();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [isDbQuiz, setIsDbQuiz] = useState(false);
    const [pageState, setPageState] = useState<PageState>('loading');
    const [remainingCount, setRemainingCount] = useState<number | undefined>(undefined);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [answeredQuestionIds, setAnsweredQuestionIds] = useState<string[]>([]);

    useEffect(() => {
        const loadQuiz = async () => {
            const quizId = params.id;

            if (!quizId) {
                setPageState('error');
                return;
            }

            // 로그인 시 DB에서 먼저 시도
            if (user) {
                const dbQuiz = await getQuizFromDb(quizId);
                if (dbQuiz) {
                    setQuiz(dbQuiz);
                    setIsDbQuiz(true);
                    setRemainingCount(dbQuiz.remainingCount);
                    setPageState('ready');
                    return;
                }
            }

            // DB에 없으면 로컬 스토리지에서 로드
            const loadedQuiz = getQuizFromLocal(quizId);

            if (!loadedQuiz) {
                setPageState('error');
                return;
            }

            setQuiz(loadedQuiz);
            setIsDbQuiz(false);
            setRemainingCount(loadedQuiz.remainingCount);
            setPageState('ready');
        };

        loadQuiz();
    }, [params.id, user]);

    // 더 풀기 핸들러
    const handleLoadMore = useCallback(async () => {
        if (!quiz?.poolId || isLoadingMore) return;

        setIsLoadingMore(true);
        try {
            // 현재까지 푼 문제 ID 수집 (중복 방지)
            const excludeIds = [...answeredQuestionIds, ...quiz.questions.map(q => q.id)];

            const response = await fetch('/api/quiz/load-more', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    poolId: quiz.poolId,
                    count: 5, // 한 번에 5문제씩 로드
                    excludeIds: user ? excludeIds : undefined,
                }),
            });

            if (!response.ok) {
                throw new Error('문제 로드 실패');
            }

            const data = await response.json();

            if (data.success && data.questions?.length > 0) {
                // 새 문제로 퀴즈 업데이트
                const newQuestions: Question[] = data.questions;
                const updatedQuiz: Quiz = {
                    ...quiz,
                    questions: newQuestions,
                    remainingCount: data.remainingCount,
                };

                setQuiz(updatedQuiz);
                setRemainingCount(data.remainingCount);
                setAnsweredQuestionIds(excludeIds);

                // 로컬 스토리지도 업데이트
                saveQuizToLocal(updatedQuiz);
            }
        } catch (error) {
            console.error('Load more failed:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [quiz, user, answeredQuestionIds, isLoadingMore]);

    // 로딩 상태
    if (pageState === 'loading') {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-center">
                    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
                    <p className="text-foreground/70">퀴즈를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    // 에러 상태 (퀴즈를 찾을 수 없음)
    if (pageState === 'error' || !quiz) {
        return (
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-error/10 flex items-center justify-center">
                        <svg
                            className="w-10 h-10 text-error"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        {ERROR_MESSAGES.QUIZ_NOT_FOUND}
                    </h1>
                    <p className="text-foreground/60 mb-6">
                        요청하신 퀴즈가 존재하지 않거나 삭제되었습니다.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link href="/upload">
                            <Button variant="primary" className="w-full sm:w-auto">
                                새 퀴즈 만들기
                            </Button>
                        </Link>
                        <Link href="/">
                            <Button variant="outline" className="w-full sm:w-auto">
                                홈으로 돌아가기
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            <MinimalHeader title={quiz.title} />
            <div className="container mx-auto px-4 py-6 max-w-3xl">
                {/* 퀴즈 플레이어 */}
                <QuizPlayer
                    quiz={quiz}
                    isDbQuiz={isDbQuiz}
                    onLoadMore={quiz.poolId ? handleLoadMore : undefined}
                    isLoadingMore={isLoadingMore}
                    remainingCount={remainingCount}
                />
            </div>
        </>
    );
}
