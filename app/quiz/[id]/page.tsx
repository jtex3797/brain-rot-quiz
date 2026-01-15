'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { Button } from '@/components/ui/Button';
import { getQuizFromLocal } from '@/lib/utils/storage';
import { ERROR_MESSAGES } from '@/lib/constants';
import type { Quiz } from '@/types';

type PageState = 'loading' | 'error' | 'ready';

export default function QuizPage() {
  const params = useParams<{ id: string }>();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');

  useEffect(() => {
    const quizId = params.id;

    if (!quizId) {
      setPageState('error');
      return;
    }

    // 로컬 스토리지에서 퀴즈 로드
    const loadedQuiz = getQuizFromLocal(quizId);

    if (!loadedQuiz) {
      setPageState('error');
      return;
    }

    setQuiz(loadedQuiz);
    setPageState('ready');
  }, [params.id]);

  // 로딩 상태
  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {/* 헤더 */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-foreground/60 hover:text-primary transition-colors"
          >
            ← 나가기
          </Link>
          <h1 className="text-2xl font-bold text-foreground mt-2">{quiz.title}</h1>
        </div>

        {/* 퀴즈 플레이어 */}
        <QuizPlayer quiz={quiz} />
      </div>
    </div>
  );
}
