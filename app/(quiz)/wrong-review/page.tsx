'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { Quiz, Question } from '@/types';

function WrongReviewContent() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const quizId = searchParams.get('quizId') || undefined;

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [questionIdMap, setQuestionIdMap] = useState<Record<string, string>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadWrongAnswers() {
            if (!user) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams();
                if (quizId) params.set('quizId', quizId);

                const response = await fetch(`/api/wrong-answers/quiz?${params}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '오답 로드 실패');
                }

                if (data.success && data.questions.length > 0) {
                    setQuiz({
                        id: `wrong-review-${Date.now()}`,
                        title: '오답 복습',
                        questions: data.questions as Question[],
                        createdAt: new Date(),
                    });
                    // questionIdMap 저장 (resolved 처리용)
                    setQuestionIdMap(data.questionIdMap || {});
                } else {
                    setQuiz(null);
                    setQuestionIdMap({});
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : '오답 로드에 실패했습니다');
            } finally {
                setIsLoading(false);
            }
        }

        if (!authLoading) {
            loadWrongAnswers();
        }
    }, [user, authLoading, quizId]);

    // 로딩 상태
    if (authLoading || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-foreground/70">오답 문제를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    // 비로그인 상태
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12 text-center">
                        <p className="text-foreground/70 mb-4">
                            오답 복습을 하려면 로그인이 필요합니다
                        </p>
                        <Link href="/auth/login">
                            <Button variant="primary">로그인하기</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 에러 상태
    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12 text-center">
                        <p className="text-error mb-4">{error}</p>
                        <Button variant="outline" onClick={() => router.push('/wrong-answers')}>
                            오답노트로 돌아가기
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 오답이 없는 경우
    if (!quiz || quiz.questions.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="py-12 text-center">
                        <div className="text-4xl mb-4">🎉</div>
                        <h2 className="text-xl font-bold mb-2">복습할 오답이 없습니다!</h2>
                        <p className="text-foreground/70 mb-6">
                            모든 문제를 맞추셨거나 아직 퀴즈를 풀지 않으셨습니다.
                        </p>
                        <div className="flex gap-2 justify-center">
                            <Button variant="outline" onClick={() => router.push('/wrong-answers')}>
                                오답노트
                            </Button>
                            <Button variant="primary" onClick={() => router.push('/upload')}>
                                새 퀴즈 풀기
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 퀴즈 플레이
    return (
        <QuizPlayer
            key={quiz.id}
            quiz={quiz}
            isDbQuiz={false}
            externalQuestionIdMap={questionIdMap}
            backHref="/wrong-answers"
        />
    );
}

export default function WrongReviewPage() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center min-h-screen">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            }
        >
            <WrongReviewContent />
        </Suspense>
    );
}
