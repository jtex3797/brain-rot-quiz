'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMyQuizzes, deleteQuizFromDb } from '@/lib/supabase/quiz';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { DbQuiz } from '@/types/supabase';

export default function MyQuizzesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<DbQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 퀴즈 목록 로드
  useEffect(() => {
    async function loadQuizzes() {
      if (!user) return;

      setIsLoading(true);
      const data = await getMyQuizzes(user.id);
      setQuizzes(data);
      setIsLoading(false);
    }

    if (!authLoading) {
      loadQuizzes();
    }
  }, [user, authLoading]);

  // 퀴즈 삭제
  async function handleDelete(quizId: string) {
    if (!user) return;
    if (!confirm('정말 이 퀴즈를 삭제하시겠습니까?')) return;

    setDeletingId(quizId);
    const result = await deleteQuizFromDb(quizId, user.id);

    if (result.success) {
      setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
    } else {
      alert('삭제 실패: ' + result.error);
    }
    setDeletingId(null);
  }

  // 난이도 뱃지 색상
  function getDifficultyColor(difficulty: string | null): string {
    switch (difficulty) {
      case 'easy':
        return 'bg-success/20 text-success';
      case 'medium':
        return 'bg-combo/20 text-combo';
      case 'hard':
        return 'bg-error/20 text-error';
      default:
        return 'bg-foreground/10 text-foreground/60';
    }
  }

  // 난이도 한글 변환
  function getDifficultyLabel(difficulty: string | null): string {
    switch (difficulty) {
      case 'easy':
        return '쉬움';
      case 'medium':
        return '보통';
      case 'hard':
        return '어려움';
      default:
        return '미설정';
    }
  }

  // 로딩 상태
  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-foreground/70">퀴즈 목록을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // 비로그인 상태 (middleware에서 처리하지만 안전장치)
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-foreground/70 mb-4">로그인이 필요합니다.</p>
          <Link href="/auth/login">
            <Button variant="primary">로그인하기</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* 헤더 */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-primary hover:underline mb-4 inline-block"
          >
            ← 홈으로 돌아가기
          </Link>
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold text-foreground">내 퀴즈</h1>
            <Link href="/upload">
              <Button variant="primary">+ 새 퀴즈 만들기</Button>
            </Link>
          </div>
        </div>

        {/* 퀴즈 목록 */}
        {quizzes.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <div className="text-6xl mb-4">📚</div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  아직 만든 퀴즈가 없어요
                </h2>
                <p className="text-foreground/60 mb-6">
                  텍스트를 입력하면 AI가 자동으로 퀴즈를 생성해줍니다.
                </p>
                <Link href="/upload">
                  <Button variant="primary" size="lg">
                    첫 번째 퀴즈 만들기
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* 퀴즈 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-foreground truncate">
                          {quiz.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${getDifficultyColor(quiz.difficulty)}`}
                        >
                          {getDifficultyLabel(quiz.difficulty)}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-foreground/60">
                        <span>📝 {quiz.question_count}문제</span>
                        <span>
                          📅{' '}
                          {new Date(quiz.created_at).toLocaleDateString(
                            'ko-KR',
                            {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            }
                          )}
                        </span>
                        {quiz.is_public && (
                          <span className="text-primary">🔗 공개</span>
                        )}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => router.push(`/quiz/${quiz.id}`)}
                      >
                        풀기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(quiz.id)}
                        disabled={deletingId === quiz.id}
                      >
                        {deletingId === quiz.id ? '삭제 중...' : '삭제'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 퀴즈 개수 표시 */}
        {quizzes.length > 0 && (
          <p className="text-center text-foreground/50 mt-6">
            총 {quizzes.length}개의 퀴즈
          </p>
        )}
      </div>
    </div>
  );
}
