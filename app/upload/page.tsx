'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { saveQuizToLocal } from '@/lib/utils/storage';
import { useAuth } from '@/contexts/AuthContext';
import { saveQuizToDb } from '@/lib/supabase/quiz';
import {
  CONTENT_LENGTH,
  DIFFICULTY_OPTIONS,
  ERROR_MESSAGES,
  type Difficulty,
} from '@/lib/constants';
import type { Quiz } from '@/types';
import type { QuestionCapacity } from '@/lib/quiz';

// 디바운스 유틸리티
function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default function UploadPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [content, setContent] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 텍스트 분석 상태
  const [textCapacity, setTextCapacity] = useState<QuestionCapacity | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 텍스트 분석 함수
  const analyzeContent = useCallback(async (text: string) => {
    if (text.length < CONTENT_LENGTH.MIN) {
      setTextCapacity(null);
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/quiz/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });

      if (response.ok) {
        const data = await response.json();
        setTextCapacity(data.capacity);

        // 현재 선택된 문제 수가 최대를 초과하면 자동 조정
        if (data.capacity && questionCount > data.capacity.max) {
          setQuestionCount(data.capacity.optimal);
        }
      }
    } catch (err) {
      console.error('Text analysis failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  }, [questionCount]);

  // 디바운스된 분석 함수
  const debouncedAnalyze = useMemo(
    () => debounce(analyzeContent, 500),
    [analyzeContent]
  );

  // 텍스트 변경 시 분석 실행
  useEffect(() => {
    debouncedAnalyze(content);
  }, [content, debouncedAnalyze]);

  const handleGenerate = async () => {
    if (!content.trim()) {
      setError(ERROR_MESSAGES.CONTENT_REQUIRED);
      return;
    }

    if (content.trim().length < CONTENT_LENGTH.MIN) {
      setError(ERROR_MESSAGES.CONTENT_TOO_SHORT);
      return;
    }

    setLoading(true);
    setError(null);
    setProgress(10);

    try {
      setProgress(30);

      // API 호출
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          questionCount,
          difficulty,
        }),
      });

      setProgress(70);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || ERROR_MESSAGES.QUIZ_GENERATION_FAILED);
      }

      const data = await response.json();
      setProgress(90);

      if (!data.success || !data.quiz) {
        throw new Error(ERROR_MESSAGES.QUIZ_DATA_MISSING);
      }

      const quiz: Quiz = {
        ...data.quiz,
        // Question Pool 시스템에서 반환된 추가 정보 포함
        poolId: data.poolId,
        remainingCount: data.remainingCount,
      };

      // 로컬 스토리지에 저장
      saveQuizToLocal(quiz);

      // 로그인 시 DB에도 저장
      if (user) {
        const dbResult = await saveQuizToDb(quiz, user.id, content, difficulty);
        if (!dbResult.success) {
          console.warn('DB 저장 실패, localStorage만 사용:', dbResult.error);
        }
      }

      setProgress(100);

      // 퀴즈 페이지로 이동
      router.push(`/quiz/${quiz.id}`);
    } catch (err) {
      console.error('Quiz generation error:', err);
      const message = err instanceof Error ? err.message : ERROR_MESSAGES.QUIZ_GENERATION_ERROR;
      setError(message);
      setProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 텍스트 파일만 허용
    if (!file.type.startsWith('text/')) {
      setError(ERROR_MESSAGES.FILE_TEXT_ONLY);
      return;
    }

    try {
      const text = await file.text();
      setContent(text);
      setError(null);
    } catch {
      setError(ERROR_MESSAGES.FILE_READ_FAILED);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8">
          <Link href="/" className="text-primary hover:underline mb-4 inline-block">
            ← 홈으로 돌아가기
          </Link>
          <h1 className="text-4xl font-bold text-foreground">퀴즈 생성하기</h1>
          <p className="mt-2 text-foreground/70">
            학습하고 싶은 텍스트를 입력하면 AI가 자동으로 퀴즈를 생성해드립니다
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 메인 입력 영역 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>텍스트 입력</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 텍스트 영역 */}
                <div>
                  <label htmlFor="content" className="mb-2 block text-sm font-medium text-foreground">
                    학습할 내용
                  </label>
                  <textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="여기에 텍스트를 입력하거나 붙여넣기 하세요...&#10;&#10;예시: React는 Facebook이 개발한 UI 라이브러리입니다. 가상 DOM을 사용하여 성능을 최적화합니다."
                    className="h-64 w-full rounded-lg border border-foreground/20 bg-background p-4 text-foreground placeholder:text-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    disabled={loading}
                  />
                  <p className="mt-2 text-sm text-foreground/60">
                    {content.length} / 최소 {CONTENT_LENGTH.MIN}자
                  </p>
                </div>

                {/* 파일 업로드 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    또는 파일 업로드
                  </label>
                  <input
                    type="file"
                    accept=".txt,.md"
                    onChange={handleFileUpload}
                    disabled={loading}
                    className="block w-full text-sm text-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary-hover disabled:opacity-50"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 옵션 영역 */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>퀴즈 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 문제 수 */}
                <div>
                  <label htmlFor="questionCount" className="mb-2 block text-sm font-medium text-foreground">
                    문제 수: {questionCount}개
                    {textCapacity && (
                      <span className="ml-2 text-xs text-foreground/60">
                        (최대 {textCapacity.max}개 가능)
                      </span>
                    )}
                    {isAnalyzing && (
                      <span className="ml-2 text-xs text-foreground/40">분석 중...</span>
                    )}
                  </label>
                  <input
                    type="range"
                    id="questionCount"
                    min={textCapacity?.min || 3}
                    max={textCapacity?.max || 15}
                    step="1"
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    disabled={loading || isAnalyzing}
                    className="w-full"
                  />
                  <div className="mt-1 flex justify-between text-xs text-foreground/60">
                    <span>{textCapacity?.min || 3}개</span>
                    <span>{textCapacity?.max || 15}개</span>
                  </div>

                  {/* 용량 인디케이터 */}
                  {textCapacity && textCapacity.max > 1 && (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 h-2 bg-foreground/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{ width: `${Math.min(100, (questionCount / textCapacity.max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-foreground/60 w-10 text-right">
                        {Math.round((questionCount / textCapacity.max) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* 제한 이유 표시 */}
                  {textCapacity && questionCount >= textCapacity.max && textCapacity.max < 20 && (
                    <p className="mt-2 text-xs text-amber-500">
                      {textCapacity.reason}
                    </p>
                  )}
                </div>

                {/* 난이도 */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    난이도
                  </label>
                  <div className="space-y-2">
                    {DIFFICULTY_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setDifficulty(option.value)}
                        disabled={loading}
                        className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                          difficulty === option.value
                            ? 'border-primary bg-primary/10'
                            : 'border-foreground/20 hover:border-foreground/40'
                        } disabled:opacity-50`}
                      >
                        <div className="font-medium text-foreground">{option.label}</div>
                        <div className="text-sm text-foreground/60">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 생성 버튼 */}
                <Button
                  onClick={handleGenerate}
                  loading={loading}
                  disabled={loading || !content.trim()}
                  className="w-full"
                  size="lg"
                >
                  {loading ? '퀴즈 생성 중...' : '퀴즈 생성하기'}
                </Button>

                {/* 진행률 */}
                {loading && (
                  <div className="space-y-2">
                    <ProgressBar value={progress} max={100} color="primary" />
                    <p className="text-center text-sm text-foreground/60">
                      AI가 퀴즈를 생성하고 있습니다...
                    </p>
                  </div>
                )}

                {/* 에러 메시지 */}
                {error && (
                  <div className="rounded-lg bg-error/10 border border-error/20 p-4 text-sm text-error">
                    {error}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 안내 사항 */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <h3 className="mb-2 font-semibold text-foreground">팁</h3>
                <ul className="space-y-1 text-sm text-foreground/70">
                  <li>• 최소 50자 이상의 텍스트가 필요합니다</li>
                  <li>• 구체적인 내용일수록 좋은 퀴즈가 생성됩니다</li>
                  <li>• 문제 수가 많을수록 생성 시간이 길어집니다</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
