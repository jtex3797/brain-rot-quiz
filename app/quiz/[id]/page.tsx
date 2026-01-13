'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { getQuizFromLocal } from '@/lib/utils/storage';
import type { Quiz } from '@/types';

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const quizId = params.id as string;

    if (!quizId) {
      router.push('/');
      return;
    }

    // 로컬 스토리지에서 퀴즈 로드
    const loadedQuiz = getQuizFromLocal(quizId);

    if (!loadedQuiz) {
      alert('퀴즈를 찾을 수 없습니다');
      router.push('/');
      return;
    }

    setQuiz(loadedQuiz);
    setLoading(false);
  }, [params.id, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-foreground/70">퀴즈를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <Link href="/" className="text-primary hover:underline mb-4 inline-block">
            ← 홈으로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold text-foreground">{quiz.title}</h1>
          <p className="mt-2 text-foreground/70">
            총 {quiz.questions.length}개의 문제
          </p>
        </div>

        {/* Phase 2 안내 */}
        <Card className="mb-8 bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h2 className="mb-2 text-lg font-bold text-foreground">
              🚧 Phase 2 구현 완료!
            </h2>
            <p className="text-foreground/70">
              퀴즈가 성공적으로 생성되었습니다. 실제 퀴즈 풀이 기능은 Phase 3에서 구현됩니다.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-foreground/60">
              <li>✅ AI 퀴즈 생성 엔진</li>
              <li>✅ 멀티 모델 폴백 시스템</li>
              <li>✅ 문서 업로드 페이지</li>
              <li>⏳ 퀴즈 풀이 인터랙션 (Phase 3)</li>
              <li>⏳ 게이미피케이션 (콤보, XP) (Phase 3)</li>
              <li>⏳ 애니메이션 효과 (Phase 3)</li>
            </ul>
          </CardContent>
        </Card>

        {/* 생성된 문제 미리보기 */}
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground">생성된 문제</h2>

          {quiz.questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle>
                  문제 {index + 1}
                  <span className="ml-2 text-sm font-normal text-foreground/60">
                    ({
                      question.type === 'mcq' ? '객관식' :
                      question.type === 'ox' ? 'OX' :
                      question.type === 'short' ? '단답형' :
                      '빈칸 채우기'
                    })
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 문제 텍스트 */}
                <div className="text-lg text-foreground">
                  {question.questionText}
                </div>

                {/* 보기 (객관식/OX인 경우) */}
                {question.options && question.options.length > 0 && (
                  <div className="space-y-2">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className="rounded-lg border-2 border-foreground/20 p-3 text-foreground"
                      >
                        {option}
                      </div>
                    ))}
                  </div>
                )}

                {/* 정답 표시 (미리보기용) */}
                <div className="rounded-lg bg-success/10 border border-success/20 p-3">
                  <span className="font-semibold text-success">정답:</span>{' '}
                  <span className="text-foreground">{question.correctAnswer}</span>
                </div>

                {/* 해설 */}
                {question.explanation && (
                  <div className="rounded-lg bg-foreground/5 p-3 text-sm text-foreground/70">
                    <span className="font-semibold">해설:</span> {question.explanation}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 하단 버튼 */}
        <div className="mt-8 flex gap-4">
          <Link href="/upload">
            <Button variant="outline" size="lg">
              새 퀴즈 만들기
            </Button>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="lg">
              홈으로
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
