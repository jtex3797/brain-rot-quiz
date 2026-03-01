'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { getModelDisplayName } from '@/lib/constants';
import type { DbQuiz } from '@/types/supabase';

type EnrichedQuiz = DbQuiz & { bank_question_count?: number | null };

export default function MyQuizzesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<EnrichedQuiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 퀴즈 목록 로드 (서버 API 사용)
  useEffect(() => {
    async function loadQuizzes() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch('/api/my-quizzes');
        const data = await response.json();
        setQuizzes(data.quizzes ?? []);
      } catch (error) {
        console.error('퀴즈 목록 로드 실패:', error);
        setQuizzes([]);
      } finally {
        setIsLoading(false);
      }
    }

    if (!authLoading) {
      loadQuizzes();
    }
  }, [user, authLoading]);

  // 퀴즈 삭제 (서버 API 사용)
  async function handleDelete(quizId: string) {
    if (!user) return;
    if (!confirm('정말 이 퀴즈를 삭제하시겠습니까?')) return;

    setDeletingId(quizId);
    try {
      const response = await fetch(`/api/my-quizzes?id=${quizId}`, {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        setQuizzes((prev) => prev.filter((q) => q.id !== quizId));
      } else {
        alert('삭제 실패: ' + result.error);
      }
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다');
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
      <div className="flex items-center justify-center py-16">
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
      <div className="flex items-center justify-center py-16">
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
    <PageContainer maxWidth="MEDIUM" className="py-8">
      <PageHeader
        title="내 퀴즈"
        actions={
          <Link href="/upload">
            <Button variant="primary">+ 새 퀴즈 만들기</Button>
          </Link>
        }
      />

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
                      {quiz.ai_model && quiz.ai_model !== 'auto' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                          🤖 {getModelDisplayName(quiz.ai_model)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-foreground/60">
                      <span>📝 {quiz.bank_question_count ?? quiz.question_count}문제</span>
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
                      onClick={() => router.push(`/quiz/${quiz.id}?from=myquiz`)}
                    >
                      풀기
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/quiz-edit/${quiz.id}`)}
                    >
                      수정
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
    </PageContainer>
  );
}
